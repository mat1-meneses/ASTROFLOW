"""Clasificación del tipo de estrella variable con un modelo de aprendizaje automático.

Modelo: Random Forest (scikit-learn) entrenado con curvas de luz del catálogo OGLE-III
(banda I), aportado por un compañero del NIDS junto con su código de descriptores
(clasificador_descriptores.py). Clases: CEP, DSCT, ECL, LPV y RRLYR.

El modelo se guarda con joblib (pickle). Como cargar un pickle puede ejecutar código,
se usa un lector restringido que solo acepta clases de NumPy y scikit-learn.
"""
import math
import pathlib
import pickle
import warnings

import numpy as np
import pandas as pd
from joblib import numpy_pickle

import clasificador_descriptores as d

RUTA_MODELO = pathlib.Path(__file__).resolve().parent / "modelos" / "classifier.joblib"

FEATURES = ["Period", "Mean", "Beyond1Std", "Rcs", "Skew", "MedianBRP",
            "SmallKurtosis", "AndersonDarling", "MedianAbsDev", "Autocor_length"]

# Margen sobre el rango de valores en que el modelo toma decisiones (umbrales de sus árboles).
MARGEN_DOMINIO = 0.05
PROBABILIDAD_MINIMA = 0.5   # bajo este puntaje la clasificación se informa como poco confiable
PROBABILIDAD_ALTA = 0.7

_MODULOS_PERMITIDOS = ("numpy", "sklearn.", "joblib.numpy_pickle")


class _LectorSeguro(numpy_pickle.NumpyUnpickler):
    """Unpickler de joblib que bloquea cualquier clase fuera de NumPy y scikit-learn."""

    def find_class(self, modulo, nombre):
        if not modulo.startswith(_MODULOS_PERMITIDOS):
            raise pickle.UnpicklingError(f"Clase no permitida en el modelo: {modulo}.{nombre}")
        return super().find_class(modulo, nombre)


def cargar_modelo(ruta=RUTA_MODELO):
    with open(ruta, "rb") as f, warnings.catch_warnings():
        warnings.simplefilter("ignore")  # aviso de versión de scikit-learn al deserializar
        modelo = _LectorSeguro(str(ruta), f, ensure_native_byte_order=False).load()
    if modelo.get("schema_version") != 1 or modelo.get("feature_columns") != FEATURES:
        raise ValueError("Esquema del clasificador no soportado u orden de descriptores distinto.")
    modelo["dominio"] = _rango_de_decision(modelo["classifier"])
    return modelo


def _rango_de_decision(clasificador):
    """Rango de Period y Mean en que los árboles del modelo hacen cortes (lo que 'conoce')."""
    rangos = {}
    for nombre in ("Period", "Mean"):
        i = FEATURES.index(nombre)
        umbrales = np.concatenate([e.tree_.threshold[e.tree_.feature == i] for e in clasificador.estimators_])
        bajo, alto = float(umbrales.min()), float(umbrales.max())
        if nombre == "Period":  # escala logarítmica: margen proporcional (nunca negativo)
            rangos[nombre] = (bajo / (1 + MARGEN_DOMINIO), alto * (1 + MARGEN_DOMINIO))
        else:
            holgura = (alto - bajo) * MARGEN_DOMINIO
            rangos[nombre] = (bajo - holgura, alto + holgura)
    return rangos


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
    entrada = mod["imputer"].transform(tabla)
    clf = mod["classifier"]
    puntajes = clf.predict_proba(entrada)[0]
    orden = np.argsort(puntajes)[::-1]
    clase = str(clf.classes_[orden[0]])
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
        "segunda_clase": str(clf.classes_[orden[1]]),
        "probabilidades": {str(c): round(float(p), 4) for c, p in zip(clf.classes_, puntajes)},
        "confianza": confianza,
        "avisos": avisos,
        "descriptores": {k: (None if pd.isna(v) else float(v)) for k, v in tabla.iloc[0].items()},
        "dominio_entrenamiento": {k: [round(a, 4), round(b, 4)] for k, (a, b) in mod["dominio"].items()},
        "modelo": {
            "algoritmo": f"Random Forest ({len(clf.estimators_)} árboles)",
            "datos_entrenamiento": "OGLE-III (banda I)",
            "clases": [str(c) for c in clf.classes_],
            "f1_macro_prueba": meta.get("f1_macro"),
            "n_entrenamiento": meta.get("n_train"),
            "n_prueba": meta.get("n_test"),
        },
    }
