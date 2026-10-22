import json, re, sys, pathlib

carpeta = pathlib.Path(sys.argv[1])
rj = json.loads((carpeta / "reporte.json").read_text(encoding="utf-8"))
rep = next(v for v in rj.values() if isinstance(v, str))
fuentes = next((v for v in rj.values() if isinstance(v, list)), [])
norm = lambda s: " ".join(s.split()).lower()

print(f"T3 · {carpeta.name}")
print(f"Documentos listados en el reporte: {len(fuentes)} -> {fuentes}")

# 1) ¿Cada [Fuente n] corresponde a algo listado?
for n in sorted(set(re.findall(r"\[Fuente (\d+)\]", rep)), key=int):
    estado = "OK" if int(n) <= len(fuentes) else f"SIN DOCUMENTO (solo hay {len(fuentes)})"
    print(f"[Fuente {n}] -> {estado}")

# 2) ¿Cada cita textual está en el fragmento? (requiere fragmentos.json)
fp = carpeta / "fragmentos.json"
citas = re.findall(r"[“\"]([^”\"]{15,})[”\"]", rep)
if fp.exists():
    frs = json.loads(fp.read_text(encoding="utf-8"))
    for q in citas:
        hit = next((f for f in frs if norm(q) in norm(f["texto"])), None)
        print(f"Cita «{q[:50]}…» ->", f"OK (Fuente {hit['n']})" if hit else "NO ESTÁ en ningún fragmento")
else:
    print(f"Citas textuales encontradas: {len(citas)} (sin fragmentos.json no se pueden verificar)")