# pip install feets fastapi uvicorn
import numpy as np
import feets
import feets.preprocess
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fourier import analizar_fourier
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

    fs = feets.FeatureSpace(data=set(datos), only=DESCRIPTORES)
    try:
        resultado = fs.extract(**datos)[0]
    except Exception as exc:
        raise HTTPException(422, f"No se pudieron calcular los descriptores: {exc}")

    d = a_json(dict(resultado))
    mag = datos["magnitude"]
    med = np.median(mag)
    mad = 1.4826 * np.median(np.abs(mag - med))
    a0 = d.get("Freq1_harmonics_amplitude_0")

    periodo_ls = d["PeriodLS"][0] if d.get("PeriodLS") else None
    fo = None
    if periodo_ls:
        try:
            fo = analizar_fourier(
                datos["time"], datos["magnitude"], datos.get("error"),
                periodo_ls, N_ARMONICOS,
            )
        except Exception:
            fo = None  # si falla, se usan los valores de feets

    derivados = {
        "periodo_principal_dias": fo["periodo"] if fo else periodo_ls,
        "periodo_ls_dias": periodo_ls,
        "prob_falsa_alarma": d["Period_fit"][0] if d.get("Period_fit") else None,
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

    return {
        "n_puntos_recibidos": n,
        "n_descartados_faltantes": n_descartados,
        "n_puntos_usados": n_final,
        "descriptores": d,
        "derivados": derivados,
    }