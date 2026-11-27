// PU-21 y PU-22 — Cliente del microservicio de descriptores (CU-06, RF-11)
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { obtenerDescriptores, adaptarParaReporte } = require("../descriptoresClient.js");

const curva = { time: [1, 2, 3], magnitude: [15.1, 15.2, 15.3], error: [0.02, 0.02, 0.02] };

const respuestaServicio = {
  n_puntos_recibidos: 410,
  n_descartados_faltantes: 4,
  n_puntos_usados: 401,
  descriptores: { Mean: 19.0118, Std: 0.1765, Skew: -0.372, SmallKurtosis: -0.876, StetsonK: 0.74 },
  derivados: {
    periodo_principal_dias: 0.56479,
    prob_falsa_alarma: 1.18e-58,
    amplitud_fats: 0.3115,
    R21: 0.438,
    R31: 0.329,
    n_atipicos_4sigma: 0,
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("obtenerDescriptores", () => {
  it("PU-21: con respuesta 200 devuelve los descriptores y se mapean al formato del reporte", async () => {
    const llamadas = [];
    vi.stubGlobal("fetch", async (url, opciones) => {
      llamadas.push({ url, cuerpo: JSON.parse(opciones.body) });
      return new Response(JSON.stringify(respuestaServicio), { status: 200 });
    });

    const r = await obtenerDescriptores(curva);
    expect(r).toEqual(respuestaServicio);
    expect(llamadas[0].url).toMatch(/\/descriptores$/);
    expect(llamadas[0].cuerpo).toMatchObject({ ...curva, limpiar_ruido: true });

    const d = adaptarParaReporte(r, { calibracion: "instrumental", banda: "r" });
    expect(d).toMatchObject({
      periodo: 0.56479,
      periodoHoras: 13.55,
      amplitud: 0.3115,
      R21: 0.438,
      R31: 0.329,
      indiceKStetson: 0.74,
      puntosUsados: 401,
      puntosDescartados: 9,
      porcentajeDescartado: 2.2,
      banda: "r",
    });
    expect(d.notas[0]).toMatch(/instrumental/);
  });

  it("PU-22: si el microservicio responde 500 se lanza un error claro con el código", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>Internal Server Error</html>", { status: 500 }));
    await expect(obtenerDescriptores(curva)).rejects.toThrow(/Servicio de descriptores \(500\)/);
  });

  it("PU-22b: si el microservicio no responde a tiempo, se corta con un error claro (no se cuelga)", async () => {
    vi.stubGlobal(
      "fetch",
      (_url, opciones) =>
        new Promise((_, rechazar) => opciones.signal.addEventListener("abort", () => rechazar(opciones.signal.reason)))
    );
    const inicio = Date.now();
    await expect(obtenerDescriptores(curva, { timeoutMs: 100 })).rejects.toThrow(/no respondió/);
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it("PU-22c: un 422 del microservicio conserva el detalle del error", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ detail: "Quedan 12 puntos válidos" }), { status: 422 })
    );
    await expect(obtenerDescriptores(curva)).rejects.toThrow("Servicio de descriptores (422): Quedan 12 puntos válidos");
  });
});

describe("adaptarParaReporte — período por selección multiarmónica", () => {
  it("PU-21b: si el período no es el pico de Lomb-Scargle, el reporte recibe una nota que lo explica", () => {
    const r = adaptarParaReporte({
      ...respuestaServicio,
      derivados: { ...respuestaServicio.derivados, periodo_principal_dias: 237.39712, periodo_ls_dias: 79.198123, metodo_periodo: "multiarmonico" },
    });
    expect(r.periodo).toBe(237.39712);
    expect(r.notas.join(" ")).toMatch(/Lomb-Scargle estaba en 79\.19812 d, un submúltiplo/);
  });

  it("PU-21c: con el período de Lomb-Scargle no se agrega esa nota", () => {
    const r = adaptarParaReporte({
      ...respuestaServicio,
      derivados: { ...respuestaServicio.derivados, periodo_ls_dias: 0.56479, metodo_periodo: "lomb-scargle" },
    });
    expect(r.notas.join(" ")).not.toMatch(/submúltiplo/);
  });
});
