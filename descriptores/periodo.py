"""Búsqueda del período principal de una curva de luz.

1. Periodograma Lomb-Scargle (astropy) con una grilla explícita hasta FRECUENCIA_MAXIMA.
   feets limita la búsqueda a 100 x la frecuencia de Nyquist promedio (N / 2T); en curvas
   largas (p. ej. OGLE: ~550 puntos en 10 años) eso deja fuera los períodos de δ Scuti.

2. Selección entre candidatos. Lomb-Scargle ajusta una sinusoide, así que en curvas que no
   lo son (sobre todo binarias eclipsantes) el pico más alto suele caer en P/2 o P/3. Se
   prueban los mejores picos y sus múltiplos (x2, x3) con un ajuste de Fourier de varios
   armónicos, y se elige el que mejor reproduce la curva, con dos protecciones para que
   las estrellas pulsantes (RR Lyrae, Cefeidas, δ Scuti) conserven el período de siempre:
     - el período de Lomb-Scargle se mantiene salvo que otro candidato ajuste al menos
       MEJORA_MINIMA mejor (en chi cuadrado);
     - entre candidatos que ajustan casi igual (dentro de TOLERANCIA) gana el más corto,
       y solo se aceptan períodos con al menos CICLOS_MINIMOS ciclos en los datos.
"""
import numpy as np
from astropy.timeseries import LombScargle

FRECUENCIA_MAXIMA = 40.0     # ciclos/día  ->  período mínimo 0,025 d
MUESTRAS_POR_PICO = 10
N_PICOS = 5
MULTIPLOS = (1, 2, 3)
N_ARMONICOS_SELECCION = 8
CICLOS_MINIMOS = 4
MEJORA_MINIMA = 0.10
TOLERANCIA = 0.10
PUNTOS_REFINADO = 301
ANCHO_RELATIVO_MAXIMO = 0.10


def _pesos(error, n):
    if error is not None:
        e = np.asarray(error, float)
        if e.size == n and np.all(np.isfinite(e)) and np.all(e > 0):
            return 1.0 / np.maximum(e, 1e-3)
    return np.ones(n)


def _chi2(t, y, w, periodo, n_arm):
    a = 2 * np.pi * (t - t[0]) / periodo
    cols = [np.ones_like(t)]
    for k in range(1, n_arm + 1):
        cols += [np.cos(k * a), np.sin(k * a)]
    X = np.column_stack(cols)
    coef, *_ = np.linalg.lstsq(X * w[:, None], y * w, rcond=None)
    return float(np.sum(((y - X @ coef) * w) ** 2))


def _refinar(t, y, w, periodo, base, n_arm):
    """Mejor período (y su chi cuadrado) en una grilla estrecha alrededor del candidato."""
    # Ventana proporcional a P²/T (resolución del periodograma), pero nunca más de ±10 % de P:
    # en períodos largos la ventana crecía tanto que el refinamiento saltaba a otro múltiplo.
    ancho = min(3 * periodo**2 / base, ANCHO_RELATIVO_MAXIMO * periodo)
    grilla = np.linspace(periodo - ancho, periodo + ancho, PUNTOS_REFINADO)
    chi = [_chi2(t, y, w, p, n_arm) for p in grilla]
    i = int(np.argmin(chi))
    return float(grilla[i]), float(chi[i])


def _picos(frecuencia, potencia, n):
    """Frecuencias de los n máximos locales más altos del periodograma."""
    i = np.flatnonzero((potencia[1:-1] > potencia[:-2]) & (potencia[1:-1] >= potencia[2:])) + 1
    if i.size == 0:
        i = np.array([int(np.argmax(potencia))])
    i = i[np.argsort(potencia[i])[::-1][:n]]
    return frecuencia[i]


def buscar_periodo(tiempo, magnitud, error=None):
    """Devuelve {periodo, periodo_ls, prob_falsa_alarma, metodo} o None si no se puede calcular.

    metodo = "lomb-scargle" si se mantuvo el pico más alto del periodograma, o
             "multiarmonico" si un múltiplo de un pico ajustó claramente mejor.
    prob_falsa_alarma corresponde siempre al pico más alto de Lomb-Scargle (Baluev).
    """
    t = np.asarray(tiempo, float)
    y = np.asarray(magnitud, float)
    orden = np.argsort(t)
    t, y = t[orden], y[orden]
    base = float(np.ptp(t))
    if base <= 0 or t.size < 10:
        return None
    w = _pesos(None if error is None else np.asarray(error, float)[orden], t.size)
    dy = None if np.all(w == 1) else 1.0 / w

    ls = LombScargle(t, y, dy)
    fmin, fmax = 1.0 / base, FRECUENCIA_MAXIMA
    frecuencia, potencia = ls.autopower(
        minimum_frequency=fmin, maximum_frequency=fmax, samples_per_peak=MUESTRAS_POR_PICO
    )
    i_max = int(np.argmax(potencia))
    periodo_ls = float(1.0 / frecuencia[i_max])
    fap = float(ls.false_alarm_probability(
        potencia[i_max], minimum_frequency=fmin, maximum_frequency=fmax
    ))
    resultado = {"periodo": periodo_ls, "periodo_ls": periodo_ls,
                 "prob_falsa_alarma": fap, "metodo": "lomb-scargle"}

    # Con pocos puntos un ajuste de 8 armónicos sobreajusta: se usan menos.
    n_arm = int(min(N_ARMONICOS_SELECCION, (t.size - 1) // 6))
    if n_arm < 2:
        return resultado

    _, chi_ls = _refinar(t, y, w, periodo_ls, base, n_arm)
    candidatos = []
    for f in _picos(frecuencia, potencia, N_PICOS):
        for k in MULTIPLOS:
            p = k / float(f)
            if base / p < CICLOS_MINIMOS:
                continue
            p_ref, chi = _refinar(t, y, w, p, base, n_arm)
            if base / p_ref >= CICLOS_MINIMOS:  # se revisa de nuevo tras refinar
                candidatos.append((p_ref, chi))
    if not candidatos:
        return resultado

    chi_mejor = min(c for _, c in candidatos)
    if chi_mejor >= (1 - MEJORA_MINIMA) * chi_ls:
        return resultado  # ningún candidato mejora claramente: se mantiene Lomb-Scargle
    periodo = min(p for p, c in candidatos if c <= (1 + TOLERANCIA) * chi_mejor)
    resultado.update(periodo=periodo, metodo="multiarmonico")
    return resultado
