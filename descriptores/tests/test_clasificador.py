"""Pruebas del clasificador de estrellas variables (Random Forest entrenado con OGLE-III)."""
import os
import pathlib
import pickle

import numpy as np
import pytest
from fastapi.testclient import TestClient

import clasificador
import clasificador_descriptores as d
from main import CENTINELA, app

cliente = TestClient(app)
ARCHIVO_MACHO = pathlib.Path(__file__).resolve().parent.parent / "9.5482.957.publc.txt"
CLASES = {"CEP", "DSCT", "ECL", "LPV", "RRLYR"}


def curva_macho():
    t, m, e = np.loadtxt(ARCHIVO_MACHO, comments="#", usecols=(0, 1, 2)).T
    ok = np.isfinite(m) & (np.abs(m) < CENTINELA) & (e > 0) & (e < CENTINELA)
    o = np.argsort(t[ok])
    return t[ok][o], m[ok][o], e[ok][o]


class Malicioso:
    """Objeto que, al cargarse con pickle normal, ejecutaría un comando del sistema."""
    def __reduce__(self):
        return (os.system, ("echo esto-no-deberia-ejecutarse",))


def test_carga_segura_bloquea_codigo_no_permitido(tmp_path):
    """El conversor (desarrollo) solo acepta clases de NumPy y scikit-learn en el .joblib."""
    import convertir_modelo
    ruta = tmp_path / "modelo_malicioso.joblib"
    ruta.write_bytes(pickle.dumps({"schema_version": 1, "x": Malicioso()}))
    with pytest.raises(pickle.UnpicklingError, match="Clase no permitida"):
        convertir_modelo.cargar_joblib(ruta)


def test_produccion_no_acepta_objetos_pickle_en_el_modelo(tmp_path):
    """El .npz se abre con allow_pickle=False: un arreglo de objetos no se carga."""
    ruta = tmp_path / "modelo.npz"
    with np.load(clasificador.RUTA_MODELO, allow_pickle=False) as z:
        arreglos = {k: z[k] for k in z.files}
    arreglos["medianas"] = np.array([Malicioso()], dtype=object)
    np.savez(ruta, **arreglos)
    with pytest.raises(ValueError):
        clasificador.cargar_modelo(ruta)


def test_modelo_carga_con_el_esquema_esperado():
    modelo = clasificador.modelo()
    assert modelo["columnas"].tolist() == clasificador.FEATURES
    assert set(modelo["clases"].tolist()) == CLASES
    assert modelo["n_arboles"] == 224
    bajo, alto = modelo["dominio"]["Mean"]
    assert 12 < bajo < 14 and 20 < alto < 22  # magnitudes calibradas de OGLE-III


def test_numpy_igual_a_scikit_learn():
    """La predicción con NumPy (producción) da los mismos puntajes que el modelo original."""
    pytest.importorskip("sklearn")
    import pandas as pd
    import convertir_modelo
    original = convertir_modelo.cargar_joblib()
    rf, imputador = original["classifier"], original["imputer"]
    mod = clasificador.modelo()

    _, m, _ = curva_macho()
    reales = pd.concat([clasificador.descriptores_modelo(m + desfase, p)
                        for desfase in (0, 22.0) for p in (0.34057, 0.68114, 5.3)])
    rng = np.random.default_rng(0)
    aleatorios = pd.DataFrame(rng.uniform(reales.min() - 1, reales.max() + 1, (2000, 10)),
                              columns=clasificador.FEATURES)
    aleatorios.iloc[::5, 2] = np.nan  # valores faltantes: los completa el imputador
    for X in (reales, aleatorios):
        esperado = rf.predict_proba(imputador.transform(X))
        obtenido = np.array([clasificador.predecir_puntajes(mod, x) for x in X.to_numpy(float)])
        assert np.abs(esperado - obtenido).max() < 1e-12
        assert (esperado.argmax(axis=1) == obtenido.argmax(axis=1)).all()
    assert mod["clases"].tolist() == [str(c) for c in rf.classes_]


def test_descriptores_iguales_a_los_del_entrenamiento():
    _, m, _ = curva_macho()
    fila = clasificador.descriptores_modelo(m, 0.34).iloc[0]
    assert list(fila.index) == clasificador.FEATURES
    assert fila["Period"] == 0.34
    assert fila["Mean"] == pytest.approx(np.mean(m))
    assert fila["Rcs"] == pytest.approx(d.rcs(m))
    assert fila["Autocor_length"] == pytest.approx(d.autocor_length(m))


def test_clasificar_entrega_cinco_puntajes_que_suman_uno():
    t, m, _ = curva_macho()
    r = clasificador.clasificar(t, m - np.mean(m) + 17.5, 0.34057)
    assert r["clase"] in CLASES
    assert set(r["probabilidades"]) == CLASES
    assert sum(r["probabilidades"].values()) == pytest.approx(1, abs=1e-3)
    assert r["clase"] == max(r["probabilidades"], key=r["probabilidades"].get)
    assert "magnitud_fuera_de_rango" not in r["avisos"]


def test_magnitud_instrumental_se_marca_poco_confiable():
    t, m, _ = curva_macho()  # magnitud instrumental MACHO ≈ -4.8
    r = clasificador.clasificar(t, m, 0.34057)
    assert r["confianza"] == "baja"
    assert "magnitud_fuera_de_rango" in r["avisos"]


def test_sin_periodo_no_clasifica():
    t, m, _ = curva_macho()
    assert clasificador.clasificar(t, m, None) is None
    assert clasificador.clasificar(t, m, 0) is None


def test_endpoint_incluye_la_clasificacion():
    t, m, e = curva_macho()
    r = cliente.post("/descriptores", json={"time": t.tolist(), "magnitude": m.tolist(), "error": e.tolist()})
    assert r.status_code == 200, r.text
    c = r.json()["clasificacion"]
    assert c["clase"] in CLASES
    assert c["confianza"] == "baja" and "magnitud_fuera_de_rango" in c["avisos"]
    assert c["modelo"]["datos_entrenamiento"].startswith("OGLE-III")
