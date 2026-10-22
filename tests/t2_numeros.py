import json, re, sys, pathlib

carpeta = pathlib.Path(sys.argv[1])
rj = json.loads((carpeta / "reporte.json").read_text(encoding="utf-8"))
rep = next(v for v in rj.values() if isinstance(v, str))   # el texto del reporte
desc = json.loads((carpeta / "descriptores.json").read_text(encoding="utf-8"))

def numeros(o):
    if isinstance(o, bool): return []
    if isinstance(o, (int, float)): return [float(o)]
    if isinstance(o, dict): return [x for v in o.values() for x in numeros(v)]
    if isinstance(o, list): return [x for v in o for x in numeros(v)]
    return []

vals = numeros(desc)
ok, revisar = [], []
for m in re.findall(r"-?\d+(?:[.,]\d+)?(?:[eE]-?\d+)?", rep):
    n = float(m.replace(",", "."))
    dec = len(re.split(r"[.,]", m)[1].split("e")[0]) if re.search(r"[.,]", m) else 0
    (ok if any(round(v, dec) == round(n, dec) for v in vals) else revisar).append(m)

print(f"T2 · {carpeta.name}")
print(f"Números que coinciden con los descriptores: {len(ok)}")
print(f"Números a revisar a mano: {len(revisar)} -> {revisar}")