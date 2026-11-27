"""Convierte el clasificador de scikit-learn (modelos/classifier.joblib) a arreglos NumPy
(modelos/classifier.npz), para que producción no necesite scikit-learn ni cargue pickles.

Se ejecuta UNA vez, en desarrollo (necesita scikit-learn, que está en requirements-dev.txt):
  docker run --rm -v "%cd%\\descriptores:/app" -w /app astroflow-descriptores ^
    sh -c "pip install -q -r requirements-dev.txt && python convertir_modelo.py"

Qué se guarda: los 224 árboles del Random Forest uno tras otro (hijos, variable y umbral de
cada nodo, y la proporción de cada clase en cada hoja), las medianas del imputador y los
metadatos del entrenamiento. clasificador.py reproduce con esto la predicción de scikit-learn
(la prueba test_numpy_igual_a_scikit_learn lo verifica).
"""
import json
import pathlib
import pickle
import warnings

import numpy as np
from joblib import numpy_pickle

CARPETA = pathlib.Path(__file__).resolve().parent / "modelos"
ORIGEN = CARPETA / "classifier.joblib"
DESTINO = CARPETA / "classifier.npz"
VERSION_FORMATO = 1

_MODULOS_PERMITIDOS = ("numpy", "sklearn.", "joblib.numpy_pickle")


class _LectorSeguro(numpy_pickle.NumpyUnpickler):
    """Unpickler de joblib que bloquea cualquier clase fuera de NumPy y scikit-learn."""

    def find_class(self, modulo, nombre):
        if not modulo.startswith(_MODULOS_PERMITIDOS):
            raise pickle.UnpicklingError(f"Clase no permitida en el modelo: {modulo}.{nombre}")
        return super().find_class(modulo, nombre)


def cargar_joblib(ruta=ORIGEN):
    """Carga el modelo original de forma segura (solo clases de NumPy y scikit-learn)."""
    with open(ruta, "rb") as f, warnings.catch_warnings():
        warnings.simplefilter("ignore")  # aviso de versión de scikit-learn al deserializar
        modelo = _LectorSeguro(str(ruta), f, ensure_native_byte_order=False).load()
    if modelo.get("schema_version") != 1:
        raise ValueError("Esquema del clasificador no soportado.")
    return modelo


def convertir(modelo):
    rf, imputador = modelo["classifier"], modelo["imputer"]
    if getattr(imputador, "strategy", None) != "median" or getattr(imputador, "add_indicator", False):
        raise ValueError("Solo se soporta un imputador por mediana sin indicadores.")

    izquierda, derecha, variable, umbral, probabilidad, raices = [], [], [], [], [], []
    desplazamiento = 0
    for arbol in rf.estimators_:
        t = arbol.tree_
        hoja = t.children_left == -1
        raices.append(desplazamiento)
        izquierda.append(np.where(hoja, -1, t.children_left + desplazamiento))
        derecha.append(np.where(hoja, -1, t.children_right + desplazamiento))
        variable.append(t.feature)
        umbral.append(t.threshold)
        v = t.value[:, 0, :]
        probabilidad.append(v / v.sum(axis=1, keepdims=True))
        desplazamiento += t.node_count

    return {
        "version": np.array(VERSION_FORMATO),
        "columnas": np.array(modelo["feature_columns"]),
        "clases": np.array([str(c) for c in rf.classes_]),
        "medianas": np.asarray(imputador.statistics_, dtype=np.float64),
        "raices": np.array(raices, dtype=np.int32),
        "izquierda": np.concatenate(izquierda).astype(np.int32),
        "derecha": np.concatenate(derecha).astype(np.int32),
        "variable": np.concatenate(variable).astype(np.int16),
        "umbral": np.concatenate(umbral).astype(np.float64),
        "probabilidad": np.concatenate(probabilidad).astype(np.float64),
        "metadata_json": np.array(json.dumps(modelo.get("metadata", {}), ensure_ascii=False)),
    }


def main():
    arreglos = convertir(cargar_joblib())
    np.savez_compressed(DESTINO, **arreglos)
    print(f"Guardado {DESTINO.name}: {len(arreglos['raices'])} árboles, "
          f"{len(arreglos['umbral'])} nodos, {DESTINO.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
