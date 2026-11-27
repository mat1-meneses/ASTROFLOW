"""Pruebas unitarias del microservicio de descriptores (FastAPI + feets).

PU-10 a PU-12 (período), PU-33 y PU-35 (limpieza y atípicos), PU-36, PU-38 y PU-39 (endpoint).
Se ejecutan con:  python -m pytest -v   (desde la carpeta descriptores/)
"""
import pathlib

import feets
import feets.preprocess
import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import CENTINELA, DESCRIPTORES, app

cliente = TestClient(app)
CARPETA = pathlib.Path(__file__).resolve().parent.parent
ARCHIVO_MACHO = CARPETA / "9.5482.957.publc.txt"


def senoide(periodo=0.5, n=500, ruido=0.0, semilla=1):
    """Curva sintética con muestreo irregular en 60 días (amplitud 0,3 mag)."""
    rng = np.random.default_rng(semilla)
    t = np.sort(rng.uniform(0, 60, n))
    m = 15 + 0.3 * np.sin(2 * np.pi * t / periodo) + rng.normal(0, ruido, n)
    e = np.full(n, 0.01 + ruido)
    return t, m, e


def enviar(t, m, e=None, limpiar_ruido=True):
    cuerpo = {
        "time": [float(x) for x in t],
        "magnitude": [float(x) for x in m],
        "limpiar_ruido": limpiar_ruido,
    }
    if e is not None:
        cuerpo["error"] = [float(x) for x in e]
    return cliente.post("/descriptores", json=cuerpo)


# ─── Período (CU-05, RF-09) ──────────────────────────────────────────────────

def test_pu10_recupera_periodo_de_senoide_sintetica():
    r = enviar(*senoide())
    assert r.status_code == 200, r.text
    periodo = r.json()["derivados"]["periodo_principal_dias"]
    assert periodo == pytest.approx(0.5, rel=0.01)


def test_pu11_tolera_ruido_gaussiano():
    t, m, e = senoide(ruido=0.03)  # σ = 10 % de la amplitud (0,3 mag)
    r = enviar(t, m, e)
    assert r.status_code == 200, r.text
    assert r.json()["derivados"]["periodo_principal_dias"] == pytest.approx(0.5, rel=0.01)


def test_pu12_rechaza_datos_insuficientes_sin_colgarse():
    t, m, e = senoide(n=10)
    r = enviar(t, m, e)
    assert r.status_code == 422  # se exigen al menos 30 observaciones


# ─── Limpieza y atípicos (CU-04, RF-05, RF-07) ───────────────────────────────

def test_pu33_elimina_observaciones_invalidas_e_informa_cuantas():
    t, m, e = senoide(n=200)
    m[10] = 99.999          # valor centinela de magnitud
    m[20] = -99.0           # valor centinela negativo
    e[30] = 0.0             # error nulo
    e[40] = -0.5            # error negativo
    e[50] = CENTINELA + 9   # error fuera de rango
    r = enviar(t, m, e, limpiar_ruido=False)

    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["n_puntos_recibidos"] == 200
    assert datos["n_descartados_faltantes"] == 5
    assert datos["n_puntos_usados"] == 195


def test_pu35_detecta_atipicos_sin_eliminarlos():
    t, m, e = senoide(n=300)
    for i in (25, 150, 275):
        m[i] += 2.0         # tres atípicos insertados
    r = enviar(t, m, e, limpiar_ruido=False)

    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["derivados"]["n_atipicos_4sigma"] == 3
    assert datos["n_puntos_usados"] == 300  # la serie no se modificó


# ─── Endpoint POST /descriptores (CU-06, RF-11) ──────────────────────────────

def cargar_macho():
    """Columnas HJD, r, err_r del archivo MACHO de ejemplo, sin valores inválidos."""
    datos = np.loadtxt(ARCHIVO_MACHO, comments="#", usecols=(0, 1, 2))
    t, m, e = datos.T
    validos = np.isfinite(t) & np.isfinite(m) & (np.abs(m) < CENTINELA) & (e > 0) & (e < CENTINELA)
    orden = np.argsort(t[validos])
    return t[validos][orden], m[validos][orden], e[validos][orden]


def test_pu36_curva_monobanda_igual_a_feets_directo():
    t, m, e = cargar_macho()
    r = enviar(t, m, e, limpiar_ruido=False)
    assert r.status_code == 200, r.text
    servicio = r.json()["descriptores"]

    fs = feets.FeatureSpace(data=["time", "magnitude", "error"], only=DESCRIPTORES)
    directo = dict(fs.extract(time=t, magnitude=m, error=e)[0])

    for nombre in ("PeriodLS", "Mean", "Std", "Skew", "StetsonK"):
        valor_directo = np.ravel(directo[nombre])[0]
        valor_servicio = np.ravel(servicio[nombre])[0]
        assert valor_servicio == pytest.approx(float(valor_directo), rel=1e-6), nombre


def test_pu38_descriptor_no_aplicable_vuelve_como_null():
    t, m, _ = senoide()
    r = enviar(t, m)  # sin columna de error: StetsonK no se puede calcular
    assert r.status_code == 200, r.text
    descriptores = r.json()["descriptores"]
    assert descriptores.get("StetsonK") is None  # 'no aplica', nunca un valor estimado


def test_pu39_entrada_sin_tiempo_responde_422_con_detalle():
    _, m, e = senoide()
    r = cliente.post("/descriptores", json={"magnitude": list(m), "error": list(e)})
    assert r.status_code == 422
    campos = [tuple(err["loc"]) for err in r.json()["detail"]]
    assert ("body", "time") in campos


def test_pu10b_recupera_periodo_corto_de_delta_scuti_con_muestreo_tipo_ogle():
    """Una curva de ~550 puntos en 10 años (1 por noche, con temporadas) y período de
    0,085 d: con la grilla por defecto de feets el período quedaba fuera de la búsqueda."""
    rng = np.random.default_rng(1)
    noches = np.arange(5262, 8921)
    noches = noches[((noches - 5262) % 365) < 240]
    t = np.sort(rng.choice(noches, 546, replace=False) + rng.uniform(-0.15, 0.15, 546))
    periodo = 0.08521925
    m = 20.6 + 0.16 * np.sin(2 * np.pi * t / periodo) + rng.normal(0, 0.18, t.size)
    e = np.full(t.size, 0.18)

    r = enviar(t, m, e)
    assert r.status_code == 200, r.text
    derivados = r.json()["derivados"]
    assert derivados["periodo_principal_dias"] == pytest.approx(periodo, rel=1e-3)
    assert derivados["prob_falsa_alarma"] < 1e-3


# ─── Selección del período entre candidatos (periodo.py) ─────────────────────

def _muestreo_ogle(rng, n=546):
    noches = np.arange(5262, 8921)
    noches = noches[((noches - 5262) % 365) < 240]
    return np.sort(rng.choice(noches, n, replace=False) + rng.uniform(-0.15, 0.15, n))


FORMAS_PULSANTES = {
    "RR Lyrae ab": (0.5667, lambda f: -0.45 * (np.sin(f) + 0.48 * np.sin(2 * f + 0.9)
                                                + 0.32 * np.sin(3 * f + 1.9) + 0.2 * np.sin(4 * f + 2.9))),
    "RR Lyrae c": (0.3211, lambda f: -0.25 * (np.sin(f) + 0.15 * np.sin(2 * f + 2.0))),
    "Cefeida": (5.3845, lambda f: -0.35 * (np.sin(f) + 0.40 * np.sin(2 * f + 0.6) + 0.18 * np.sin(3 * f + 1.4))),
    "HADS": (0.0712, lambda f: -0.3 * (np.sin(f) + 0.4 * np.sin(2 * f + 1) + 0.15 * np.sin(3 * f + 2))),
}


@pytest.mark.parametrize("tipo", list(FORMAS_PULSANTES))
def test_pu10c_pulsantes_conservan_el_periodo_de_lomb_scargle(tipo):
    """La selección multiarmónica no debe cambiar el período de RR Lyrae, Cefeidas ni δ Scuti."""
    periodo, forma = FORMAS_PULSANTES[tipo]
    rng = np.random.default_rng(0)
    t = _muestreo_ogle(rng)
    m = 18 + forma(2 * np.pi * t / periodo) + rng.normal(0, 0.03, t.size)

    r = enviar(t, m, np.full(t.size, 0.03))
    assert r.status_code == 200, r.text
    derivados = r.json()["derivados"]
    assert derivados["metodo_periodo"] == "lomb-scargle"
    assert derivados["periodo_principal_dias"] == pytest.approx(periodo, rel=1e-3)


def test_pu10d_binaria_eclipsante_recupera_el_periodo_completo():
    """OGLE-LMC-ECL-00004 (P = 237,8733 d en OGLE): Lomb-Scargle da P/3 (~79 d)."""
    t, m, e = np.loadtxt(CARPETA / "tests" / "datos" / "OGLE-LMC-ECL-00004.dat").T
    r = enviar(t, m, e)
    assert r.status_code == 200, r.text
    derivados = r.json()["derivados"]
    assert derivados["periodo_ls_dias"] == pytest.approx(237.8733 / 3, rel=0.01)
    assert derivados["metodo_periodo"] == "multiarmonico"
    assert derivados["periodo_principal_dias"] == pytest.approx(237.8733, rel=0.01)


def test_pu10e_fase_cero_del_ajuste_no_la_mueve_un_atipico():
    """t_valor_minimo / t_valor_maximo salen del ajuste de Fourier, no de un punto aislado."""
    rng = np.random.default_rng(2)
    t = np.sort(rng.uniform(0, 60, 500))
    periodo = 0.5
    m = 15 + 0.3 * np.sin(2 * np.pi * t / periodo) + rng.normal(0, 0.01, t.size)
    m[100] -= 1.0  # punto atípico muy brillante

    r = enviar(t, m, np.full(t.size, 0.01), limpiar_ruido=False)
    assert r.status_code == 200, r.text
    d = r.json()["derivados"]
    P = d["periodo_principal_dias"]
    # Para 15 + 0,3 sin(2πt/P) el mínimo de magnitud (máximo brillo) está en fase 0,75
    fase_min = (d["t_valor_minimo"] / P) % 1
    fase_max = (d["t_valor_maximo"] / P) % 1
    assert min(abs(fase_min - 0.75), 1 - abs(fase_min - 0.75)) < 0.02
    assert min(abs(fase_max - 0.25), 1 - abs(fase_max - 0.25)) < 0.02
