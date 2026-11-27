"""Clasificación del tipo de estrella variable con un modelo de aprendizaje automático.

Modelo: Random Forest (scikit-learn) entrenado con curvas de luz del catálogo OGLE-III
(banda I), aportado por un compañero del NIDS junto con su código de descriptores
(clasificador_descriptores.py). Clases: CEP, DSCT, ECL, LPV y RRLYR.

El modelo original (modelos/classifier.joblib) se convirtió una vez a arreglos NumPy
(modelos/classifier.npz) con convertir_modelo.py. Aquí la predicción se hace solo con NumPy:
producción no necesita scikit-learn (que superaba el límite de tamaño de Vercel) y el archivo
se abre con allow_pickle=False, así que no se ejecuta ningún pickle. La prueba
test_numpy_igual_a_scikit_learn verifica que los puntajes sean los mismos que en scikit-learn.
"""
import json
import math
import pathlib

import numpy as np
import pandas as pd

import clasificador_descriptores as d

RUTA_MODELO = pathlib.Path(__file__).resolve().parent / "modelos" / "classifier.npz"

FEATURES = ["Period", "Mean", "Beyond1Std", "Rcs", "Skew", "MedianBRP",
            "SmallKurtosis", "AndersonDarling", "MedianAbsDev", "Autocor_length"]

# Margen sobre el rango de valores en que el modelo toma decisiones (umbrales de sus árboles).
MARGEN_DOMINIO = 0.05
PROBABILIDAD_MINIMA = 0.5   # bajo este puntaje la clasificación se informa como poco confiable
PROBABILIDAD_ALTA = 0.7

_ARREGLOS = ("version", "columnas", "clases", "medianas", "raices", "izquierda",
             "derecha", "variable", "umbral", "probabilidad", "metadata_json")


def cargar_modelo(ruta=RUTA_MODELO):
    with np.load(ruta, allow_pickle=False) as z:
        if set(z.files) != set(_ARREGLOS):
            raise ValueError("El archivo del clasificador no tiene los arreglos esperados.")
        modelo = {k: z[k] for k in _ARREGLOS}
    if int(modelo["version"]) != 1 or modelo["columnas"].tolist() != FEATURES:
        raise ValueError("Formato del clasificador no soportado u orden de descriptores distinto.")
    modelo["metadata"] = json.loads(str(modelo.pop("metadata_json")))
    modelo["n_arboles"] = len(modelo["raices"])
    modelo["dominio"] = _rango_de_decision(modelo)
    return modelo


def _rango_de_decision(mod):
    """Rango de Period y Mean en que los árboles del modelo hacen cortes (lo que 'conoce')."""
    rangos = {}
    internos = mod["izquierda"] != -1
    for nombre in ("Period", "Mean"):
        umbrales = mod["umbral"][internos & (mod["variable"] == FEATURES.index(nombre))]
        bajo, alto = float(umbrales.min()), float(umbrales.max())
        if nombre == "Period":  # escala logarítmica: margen proporcional (nunca negativo)
            rangos[nombre] = (bajo / (1 + MARGEN_DOMINIO), alto * (1 + MARGEN_DOMINIO))
        else:
            holgura = (alto - bajo) * MARGEN_DOMINIO
            rangos[nombre] = (bajo - holgura, alto + holgura)
    return rangos


def predecir_puntajes(mod, fila):
    """Puntaje de cada clase para un vector de descriptores, igual que scikit-learn:
    imputación por mediana, recorrido de cada árbol hasta su hoja y promedio de las hojas."""
    x = np.asarray(fila, dtype=np.float64)
    x = np.where(np.isnan(x), mod["medianas"], x)
    x = x.astype(np.float32).astype(np.float64)  # scikit-learn compara en float32
    izq, der, var, umb = mod["izquierda"], mod["derecha"], mod["variable"], mod["umbral"]
    nodos = mod["raices"].astype(np.int64)
    while True:
        internos = izq[nodos] != -1
        if not internos.any():
            break
        n = nodos[internos]
        nodos[internos] = np.where(x[var[n]] <= umb[n], izq[n], der[n])
    return mod["probabilidad"][nodos].mean(axis=0)


_modelo = None


def modelo():
    global _modelo
    if _modelo is None:
        _modelo = cargar_modelo()
    return _modelo


def descriptores_modelo(magnitud, periodo):
    """Los 10 descriptores en el mismo orden y con las mismas funciones del entrenamiento."""
    m = np.asarray(magnitud, dtype=float)
    valores = [periodo, np.mean(m), d.beyond1std(m), d.rcs(m), d.skewness(m),
               d.median_brp(m), d.small_kurtosis(m), d.anderson_darling(m),
               d.median_abs_dev(m), d.autocor_length(m)]
    return pd.DataFrame([valores], columns=FEATURES).replace([np.inf, -np.inf], np.nan)


def clasificar(tiempo, magnitud, periodo):
    """Devuelve la clase más probable, el puntaje de cada clase y avisos de confiabilidad.

    tiempo y magnitud deben venir ordenados por tiempo; periodo en días (Lomb-Scargle).
    """
    if periodo is None or not math.isfinite(periodo) or periodo <= 0:
        return None
    mod = modelo()
    tabla = descriptores_modelo(magnitud, periodo)
    puntajes = predecir_puntajes(mod, tabla.iloc[0].to_numpy(dtype=np.float64))
    clases = mod["clases"].tolist()
    orden = np.argsort(puntajes)[::-1]
    clase = str(clases[orden[0]])
    puntaje_max = float(puntajes[orden[0]])

    avisos = []
    for nombre, codigo in (("Mean", "magnitud_fuera_de_rango"), ("Period", "periodo_fuera_de_rango")):
        valor = float(tabla.iloc[0][nombre])
        bajo, alto = mod["dominio"][nombre]
        if not (bajo <= valor <= alto):
            avisos.append(codigo)
    if puntaje_max < PROBABILIDAD_MINIMA:
        avisos.append("puntaje_bajo")

    if avisos:
        confianza = "baja"
    elif puntaje_max >= PROBABILIDAD_ALTA:
        confianza = "alta"
    else:
        confianza = "media"

    meta = mod.get("metadata", {})
    return {
        "clase": clase,
        "segunda_clase": str(clases[orden[1]]),
        "probabilidades": {str(c): round(float(p), 4) for c, p in zip(clases, puntajes)},
        "confianza": confianza,
        "avisos": avisos,
        "descriptores": {k: (None if pd.isna(v) else float(v)) for k, v in tabla.iloc[0].items()},
        "dominio_entrenamiento": {k: [round(a, 4), round(b, 4)] for k, (a, b) in mod["dominio"].items()},
        "modelo": {
            "algoritmo": f"Random Forest ({mod['n_arboles']} árboles)",
            "datos_entrenamiento": "OGLE-III (banda I)",
            "clases": clases,
            "f1_macro_prueba": meta.get("f1_macro"),
            "n_entrenamiento": meta.get("n_train"),
            "n_prueba": meta.get("n_test"),
        },
    }
