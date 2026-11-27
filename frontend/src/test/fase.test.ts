// PU-13 — Plegado en fase para visualización (CU-05, RF-10)
import { describe, expect, it } from "vitest";
import type { LightCurvePoint } from "../types";
import { plegarEnFase } from "../utils/fase";

const puntos: LightCurvePoint[] = [0, 0.5, 1, 1.5, 3, 4.25, 7.9].map((t, i) => ({
  time: t,
  flux: 15 + (i === 0 ? -0.5 : 0.1 * i), // el primer punto es el más brillante (menor magnitud)
  error: 0.02,
}));

describe("plegarEnFase", () => {
  it("PU-13: calcula fases correctas con P = 2 d (dos ciclos, fase 0 en el máximo de brillo)", () => {
    const fase = plegarEnFase(puntos, 2, "magnitud");

    // Se devuelven dos ciclos (φ 0–2) para ver la forma completa: 2 puntos por observación
    expect(fase).toHaveLength(puntos.length * 2);
    const primerCiclo = fase.filter((_, i) => i % 2 === 0);
    expect(primerCiclo.every((p) => p.phase >= 0 && p.phase < 1)).toBe(true);
    fase.forEach((p, i) => {
      if (i % 2 === 1) expect(p.phase).toBeCloseTo(fase[i - 1].phase + 1, 10);
    });
    // Valores conocidos: t = 0.5 → 0.25 ; t = 3 → 0.5 ; t = 7.9 → 0.95
    expect(primerCiclo.map((p) => p.phase)).toEqual(
      [0, 0.25, 0.5, 0.75, 0.5, 0.125, 0.95].map((v) => expect.closeTo(v, 10))
    );
  });

  it("PU-13b: sin período válido no pliega (devuelve lista vacía)", () => {
    expect(plegarEnFase(puntos, null, "magnitud")).toEqual([]);
    expect(plegarEnFase(puntos, 0, "magnitud")).toEqual([]);
  });

  it("PU-13c: con el instante del ajuste de Fourier, un punto atípico no desplaza la fase 0", () => {
    // El primer punto (t = 0) es el más brillante, pero el ajuste ubica el máximo en t = 0.5
    const fase = plegarEnFase(puntos, 2, "magnitud", "maximo", { tValorMinimo: 0.5, tValorMaximo: 1.5 });
    const primerCiclo = fase.filter((_, i) => i % 2 === 0);
    // t = 0.5 → 0 ; t = 0 → 0.75 ; t = 3 → 0.25
    expect(primerCiclo[1].phase).toBeCloseTo(0, 10);
    expect(primerCiclo[0].phase).toBeCloseTo(0.75, 10);
    expect(primerCiclo[4].phase).toBeCloseTo(0.25, 10);
  });

  it("PU-13d: en modo mínimo la fase 0 va al mínimo de brillo (magnitud mayor, o flujo menor)", () => {
    const enMagnitud = plegarEnFase(puntos, 2, "magnitud", "minimo", { tValorMinimo: 0.5, tValorMaximo: 1.5 });
    expect(enMagnitud.filter((_, i) => i % 2 === 0)[3].phase).toBeCloseTo(0, 10); // t = 1.5
    const enFlujo = plegarEnFase(puntos, 2, "flujo", "minimo", { tValorMinimo: 0.5, tValorMaximo: 1.5 });
    expect(enFlujo.filter((_, i) => i % 2 === 0)[1].phase).toBeCloseTo(0, 10); // t = 0.5
    // Sin instantes del ajuste (análisis antiguos): punto observado más débil (t = 7.9, magnitud 15.6)
    const sinAjuste = plegarEnFase(puntos, 2, "magnitud", "minimo");
    expect(sinAjuste.filter((_, i) => i % 2 === 0)[6].phase).toBeCloseTo(0, 10);
  });
});

