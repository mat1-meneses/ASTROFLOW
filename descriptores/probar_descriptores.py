import sys
import json
import requests

COLUMNAS = {"r": (1, 2), "b": (3, 4)}

def leer_curva(ruta, banda="r"):
    """MACHO: HJD, r, err_r, b, err_b, obsid, tran. Salta encabezados (#)."""
    i_mag, i_err = COLUMNAS[banda]
    t, m, e = [], [], []
    with open(ruta, encoding="utf-8", errors="ignore") as f:
        for linea in f:
            try:
                valores = [float(x) for x in linea.split()]
            except ValueError:
                continue
            if len(valores) >= 5:
                t.append(valores[0]); m.append(valores[i_mag]); e.append(valores[i_err])
    return t, m, e

ruta = sys.argv[1]
banda = sys.argv[2] if len(sys.argv) > 2 else "r"
t, m, e = leer_curva(ruta, banda)
print(f"Banda {banda}: {len(t)} puntos leídos")

resp = requests.post(
    "http://127.0.0.1:8000/descriptores",
    json={"time": t, "magnitude": m, "error": e, "limpiar_ruido": True},
    timeout=120,
)
print("Status:", resp.status_code)
print(json.dumps(resp.json(), indent=2, ensure_ascii=False))