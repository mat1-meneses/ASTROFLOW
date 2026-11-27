// PU-06 a PU-08 — Detección y validación del mapeo de columnas (CU-03, RF-02)
import { describe, expect, it } from "vitest";
import { detectColumnMapping, esMapeoValido } from "../utils/detectColumns";

const filas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    time: String(49000 + i * 0.7),
    r: String(-5.1 + (i % 5) * 0.03),
    err_r: "0.02",
  }));

describe("detectColumnMapping (sugerencia de mapeo)", () => {
  it("PU-06: sugiere tiempo, magnitud de la banda r y su error para columnas MACHO", () => {
    const d = detectColumnMapping(["time", "r", "err_r"], filas(20));

    expect(d.mapping).toEqual({ time: "time", flux: "r", error: "err_r" });
    expect(d.formatHint).toBe("macho");
    expect(d.notes).toContain("machoBandaR");
  });
});

describe("esMapeoValido", () => {
  it("PU-07: exige tiempo, brillo (magnitud/flujo) y error", () => {
    expect(esMapeoValido({ flux: "r", error: "err_r" })).toBe(false); // sin tiempo
    expect(esMapeoValido({ time: "time", error: "err_r" })).toBe(false); // sin magnitud
    expect(esMapeoValido({ time: "time", flux: "r" })).toBe(false); // sin error
    expect(esMapeoValido({ time: "time", flux: "r", error: "err_r" })).toBe(true); // completo
  });

  it("PU-08: rechaza una misma columna asignada a dos roles", () => {
    expect(esMapeoValido({ time: "r", flux: "r", error: "err_r" })).toBe(false);
    expect(esMapeoValido({ time: "time", flux: "err_r", error: "err_r" })).toBe(false);
  });
});
