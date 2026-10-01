import sys
import numpy as np

col = {"r": 1, "b": 3}[sys.argv[2] if len(sys.argv) > 2 else "r"]
filas = []
for linea in open(sys.argv[1], encoding="utf-8", errors="ignore"):
    try:
        v = [float(x) for x in linea.split()]
    except ValueError:
        continue
    if len(v) >= 5:
        filas.append(v)

m = np.array([f[col] for f in filas])
m = m[np.abs(m) < 90]
s = np.sort(m)
k = int(np.ceil(0.05 * len(s)))
mad = 1.4826 * np.median(np.abs(m - np.median(m)))

print("N:", len(m))
print("Amplitude (fórmula FATS):", round((np.median(s[-k:]) - np.median(s[:k])) / 2, 4))
print("Std:", round(m.std(), 4))
print("Percentiles 1/5/50/95/99:", np.percentile(m, [1, 5, 50, 95, 99]).round(3))
print("Puntos a más de 4 sigmas robustas:", int((np.abs(m - np.median(m)) > 4 * mad).sum()))
print("10 más brillantes:", s[:10])
print("10 más débiles:", s[-10:])