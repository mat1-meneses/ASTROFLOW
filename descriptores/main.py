# pip install feets fastapi uvicorn
import os
import traceback

# En Vercel (serverless) solo /tmp admite escritura y no existe /dev/shm,
# que necesitan matplotlib y el paralelismo por procesos.
os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")

import numpy as np
import feets

try:
    import dask
    dask.config.set(scheduler="synchronous")  # feets calcula en un solo proceso
except ImportError:
    pass
import feets.preprocess
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from periodo import buscar_periodo
from fourier import analizar_fourier
from clasificador import clasificar
N_ARMONICOS = 4


app = FastAPI(title="ASTROFLOW – Servicio de descriptores")

DESCRIPTORES = {
  
    "PeriodLS", "Period_fit", "Psi_eta", "Psi_CS",
    "Mean", "Std", "Skew", "SmallKurtosis",
    "Rcs", "Autocor_length", "StetsonK",
    "Freq1_harmonics_amplitude_0", "Freq1_harmonics_amplitude_1",
    "Freq1_harmonics_amplitude_2", "Freq1_harmonics_amplitude_3",
    "Freq1_harmonics_rel_phase_1", "Freq1_harmonics_rel_phase_2",
    "Freq1_harmonics_rel_phase_3",
}

MIN_PUNTOS = 30
CENTINELA = 90.0

class CurvaDeLuz(BaseModel):
    time: list[float] = Field(min_length=30)
    magnitude: list[float] = Field(min_length=30)
    error: list[float] | None = None
    limpiar_ruido: bool = True

def amplitud_fats(m):
    """Fórmula original de FATS (Nun & Protopapas): mitad de la diferencia
    entre la mediana del 5 % más débil y la del 5 % más brillante."""
    s = np.sort(m)
    k = int(np.ceil(0.05 * len(s)))
    return float((np.median(s[-k:]) - np.median(s[:k])) / 2)

def a_json(v):
    """Convierte tipos numpy a tipos JSON; NaN/inf -> None."""
    if isinstance(v, dict):
        return {k: a_json(x) for k, x in v.items()}
    if isinstance(v, (np.ndarray, list, tuple)):
        return [a_json(x) for x in v]
    if isinstance(v, np.generic):
        v = v.item()
    if isinstance(v, float) and not np.isfinite(v):
        return None
    return v

@app.post("/descriptores")
def calcular_descriptores(lc: CurvaDeLuz):
    n = len(lc.time)
    if len(lc.magnitude) != n or (lc.error is not None and len(lc.error) != n):
        raise HTTPException(422, "time, magnitude y error deben tener el mismo largo")

    t = np.asarray(lc.time, float)
    m = np.asarray(lc.magnitude, float)
    validos = np.isfinite(t) & np.isfinite(m) & (np.abs(m) < CENTINELA)
    if lc.error is not None:
        e = np.asarray(lc.error, float)
        validos &= np.isfinite(e) & (e > 0) & (e < CENTINELA)

    n_descartados = int((~validos).sum())
    orden = np.argsort(t[validos])
    datos = {"time": t[validos][orden], "magnitude": m[validos][orden]}
    if lc.error is not None:
        datos["error"] = e[validos][orden]
        if lc.limpiar_ruido:
            tt, mm, ee = feets.preprocess.remove_noise(**datos)
            datos = {"time": tt, "magnitude": mm, "error": ee}

    n_final = len(datos["time"])
    if n_final < MIN_PUNTOS:
        raise HTTPException(
            422,
            f"Quedan {n_final} puntos válidos tras la limpieza "
            f"({n_descartados} descartados por valores faltantes); se necesitan al menos {MIN_PUNTOS}.",
        )

    try:
        fs = feets.FeatureSpace(
            data=set(datos), only=DESCRIPTORES, dask_options={"scheduler": "synchronous"}
        )
    except TypeError:  # versiones de feets sin el parámetro dask_options
        fs = feets.FeatureSpace(data=set(datos), only=DESCRIPTORES)
    try:
        resultado = fs.extract(**datos)[0]
    except Exception as exc:
        traceback.print_exc()  # queda en los logs de Vercel para diagnosticar
        raise HTTPException(422, f"No se pudieron calcular los descriptores: {exc}")

    d = a_json(dict(resultado))
    mag = datos["magnitude"]
    med = np.median(mag)
    mad = 1.4826 * np.median(np.abs(mag - med))
    a0 = d.get("Freq1_harmonics_amplitude_0")

    # Período: Lomb-Scargle + selección entre candidatos (ver periodo.py)
    try:
        busqueda = buscar_periodo(datos["time"], datos["magnitude"], datos.get("error"))
    except Exception:
        traceback.print_exc()
        busqueda = None
    if busqueda is None:  # respaldo: el período de feets
        p_feets = d["PeriodLS"][0] if d.get("PeriodLS") else None
        busqueda = {"periodo": p_feets, "periodo_ls": p_feets,
                    "prob_falsa_alarma": d["Period_fit"][0] if d.get("Period_fit") else None,
                    "metodo": "feets"}
    periodo_ls = busqueda["periodo_ls"]
    fap = busqueda["prob_falsa_alarma"]
    fo = None
    if busqueda["periodo"]:
        try:
            fo = analizar_fourier(
                datos["time"], datos["magnitude"], datos.get("error"),
                busqueda["periodo"], N_ARMONICOS,
                ancho_relativo_max=0.02 if busqueda["metodo"] == "multiarmonico" else None,
            )
        except Exception:
            fo = None  # si falla, se usan los valores de feets

    derivados = {
        "periodo_principal_dias": fo["periodo"] if fo else busqueda["periodo"],
        "periodo_ls_dias": periodo_ls,
        "metodo_periodo": busqueda["metodo"],
        # Instantes del máximo y del mínimo del valor ajustado (Fourier): sirven para fijar
        # la fase 0 del gráfico sin depender de un punto aislado (que puede ser un atípico).
        "t_valor_minimo": fo["t_valor_minimo"] if fo else None,
        "t_valor_maximo": fo["t_valor_maximo"] if fo else None,
        "prob_falsa_alarma": fap,
        "amplitud_fats": amplitud_fats(mag),
        "R21": fo["R21"] if fo else (d["Freq1_harmonics_amplitude_1"] / a0 if a0 else None),
        "R31": fo["R31"] if fo else (d["Freq1_harmonics_amplitude_2"] / a0 if a0 else None),
        "phi21": fo["phi21"] if fo else None,
        "phi31": fo["phi31"] if fo else None,
        "amplitud_pico_a_pico_fourier": fo["amplitud_pico_a_pico"] if fo else None,
        # solo para comparar con OGLE; bórralos tras validar
        "R21_feets": d["Freq1_harmonics_amplitude_1"] / a0 if a0 else None,
        "R31_feets": d["Freq1_harmonics_amplitude_2"] / a0 if a0 else None,
        "n_atipicos_4sigma": int((np.abs(mag - med) > 4 * mad).sum()) if mad > 0 else 0,
    }

    # Tipo de estrella según el clasificador Random Forest (OGLE-III). Si falla,
    # se entregan igual los descriptores: la clasificación es un complemento.
    try:
        clasificacion = clasificar(datos["time"], datos["magnitude"], derivados["periodo_principal_dias"])
    except Exception:
        traceback.print_exc()
        clasificacion = None

    return {
        "n_puntos_recibidos": n,
        "n_descartados_faltantes": n_descartados,
        "n_puntos_usados": n_final,
        "descriptores": d,
        "derivados": derivados,
        "clasificacion": clasificacion,
    }