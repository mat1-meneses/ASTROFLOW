// Clasificador Random Forest → reporte RAG: la clase calculada orienta la búsqueda y el prompt.
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { adaptarParaReporte } = require("../descriptoresClient.js");
const rutaRetrieve = require.resolve("../retrieve.js");
const rutaFacade = require.resolve("../ragFacade.js");

const respuesta = (confianza, avisos = []) => ({
  n_puntos_recibidos: 410,
  n_descartados_faltantes: 0,
  n_puntos_usados: 401,
  descriptores: { Mean: 17.2 },
  derivados: { periodo_principal_dias: 0.5667, prob_falsa_alarma: 0.001, amplitud_fats: 0.31, R21: 0.43, R31: 0.33, n_atipicos_4sigma: 0 },
  clasificacion: {
    clase: "ECL",
    segunda_clase: "RRLYR",
    probabilidades: { CEP: 0.02, DSCT: 0.06, ECL: 0.62, LPV: 0.02, RRLYR: 0.28 },
    confianza,
    avisos,
    modelo: { algoritmo: "Random Forest (224 árboles)", datos_entrenamiento: "OGLE-III (banda I)", f1_macro_prueba: 0.708 },
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete require.cache[rutaRetrieve];
  delete require.cache[rutaFacade];
});

describe("adaptarParaReporte con clasificación", () => {
  it("una clasificación confiable define el tipo probable y la segunda clase para la búsqueda", () => {
    const d = adaptarParaReporte(respuesta("media"));
    expect(d.clasificacionModelo).toMatchObject({ clase: "eclipsing binary", puntaje: 0.62, segundaClase: "RR Lyrae", confianza: "media" });
    expect(d.tipoProbable).toBe("eclipsing binary");
    expect(d.segundoTipo).toBe("RR Lyrae");
  });

  it("una clasificación poco confiable no orienta la búsqueda, pero llega al reporte con su aviso", () => {
    const d = adaptarParaReporte(respuesta("baja", ["magnitud_fuera_de_rango"]));
    expect(d.tipoProbable).toBeNull();
    expect(d.segundoTipo).toBeNull();
    expect(d.clasificacionModelo.avisos[0]).toMatch(/fuera del rango de los datos de entrenamiento/);
  });

  it("sin clasificación (análisis antiguos) el reporte funciona igual", () => {
    const { clasificacion, ...sinClasificar } = respuesta("alta");
    const d = adaptarParaReporte(sinClasificar);
    expect(d.clasificacionModelo).toBeNull();
    expect(d.tipoProbable).toBeNull();
  });
});

describe("generarReporte con clasificación", () => {
  it("busca papers del tipo calculado y el prompt exige informar siempre la clase del modelo", async () => {
    const consultas = [];
    require.cache[rutaRetrieve] = {
      id: rutaRetrieve, filename: rutaRetrieve, loaded: true,
      exports: { retrieveContext: async (q) => { consultas.push(q); return [{ titulo: "p", contenido: "Eclipsing binaries show two minima." }]; } },
    };
    const enviados = [];
    vi.stubGlobal("fetch", async (_u, o) => {
      enviados.push(JSON.parse(o.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: "<report>## Resumen\nTexto.</report>" }] }), { status: 200 });
    });
    const { generarReporte } = require("../ragFacade.js");
    await generarReporte(adaptarParaReporte(respuesta("media")));

    expect(consultas[0]).toMatch(/^eclipsing binary variable star/);
    expect(consultas.some((q) => q.startsWith("RR Lyrae variable star light curve"))).toBe(true);
    expect(enviados[0].system).toMatch(/Always report its class, its score .* exactly as given/);
    expect(enviados[0].messages[0].content).toContain('"clase": "eclipsing binary"');
  });
});

describe("prompt de clasificación según la confianza del modelo", () => {
  async function promptPara(confianza, R21 = 0.43) {
    const consultas = [];
    require.cache[rutaRetrieve] = {
      id: rutaRetrieve, filename: rutaRetrieve, loaded: true,
      exports: { retrieveContext: async (q) => { consultas.push(q); return [{ titulo: "p", contenido: "texto" }]; } },
    };
    const enviados = [];
    vi.stubGlobal("fetch", async (_u, o) => {
      enviados.push(JSON.parse(o.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: "<report>## Resumen\nTexto.</report>" }] }), { status: 200 });
    });
    delete require.cache[rutaFacade];
    const { generarReporte } = require("../ragFacade.js");
    const r = respuesta(confianza);
    r.derivados = { ...r.derivados, R21 };
    await generarReporte(adaptarParaReporte(r));
    return { system: enviados[0].system, consultas };
  }

  it("con confianza media el LLM puede concluir otra clase si las fuentes la respaldan claramente", async () => {
    const { system } = await promptPara("media");
    expect(system).toMatch(/"media" \/ medium: evaluate the model's class, its second class/);
    expect(system).toMatch(/the most likely type of the report is that other class/);
    expect(system).toMatch(/phi21/);
  });

  it("el prompt fija la conclusión 'indeterminada' cuando los descriptores traen casoParejo", async () => {
    const { system } = await promptPara("media");
    expect(system).toMatch(/If <descriptors> contains "casoParejo", the conclusion is already decided by the platform/);
    expect(system).toMatch(/Do not choose either class/);
    expect(system).toMatch(/phi21 and phi31 are phase differences \(angles in radians\), not amplitudes/);
  });

  it("con curva casi sinusoidal (R21 pequeño) se buscan papers de cefeidas de sobretono, antes que las consultas genéricas", async () => {
    const { consultas } = await promptPara("media", 0.12);
    const i = consultas.findIndex((q) => /^first-overtone classical Cepheids/.test(q));
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(consultas.findIndex((q) => /^RR Lyrae light curve shape/.test(q)));
    const asimetrica = await promptPara("media", 0.43);
    expect(asimetrica.consultas.some((q) => /^first-overtone classical Cepheids/.test(q))).toBe(false);
  });

  it("siempre se busca la clasificación de cefeidas con R21/phi21 (OGLE) y la consulta del período va al final", async () => {
    const { consultas } = await promptPara("media");
    expect(consultas.some((q) => /Fourier parameters R21 phi21 .* OGLE/.test(q))).toBe(true);
    expect(consultas[consultas.length - 1]).toMatch(/^periodic variable star with a period of/);
  });

  it("un paper subido dos veces (\"x (1)\") no ocupa dos lugares con el mismo texto", async () => {
    require.cache[rutaRetrieve] = {
      id: rutaRetrieve, filename: rutaRetrieve, loaded: true,
      exports: { retrieveContext: async () => [
        { titulo: "0402424v2", contenido: "Mismo texto del paper." },
        { titulo: "0402424v2 (1)", contenido: "Mismo texto del paper." },
      ] },
    };
    const enviados = [];
    vi.stubGlobal("fetch", async (_u, o) => {
      enviados.push(JSON.parse(o.body));
      return new Response(JSON.stringify({ content: [{ type: "text", text: "<report>## Resumen\nTexto.</report>" }] }), { status: 200 });
    });
    delete require.cache[rutaFacade];
    const { generarReporte } = require("../ragFacade.js");
    await generarReporte(adaptarParaReporte(respuesta("media")));
    expect(enviados[0].messages[0].content.match(/<source id=/g)).toHaveLength(1);
  });
});

describe("caso parejo decidido en el código", () => {
  it("confianza media con segunda clase ≥ 0,2 marca casoParejo; alta, baja o segunda débil no", () => {
    expect(adaptarParaReporte(respuesta("media")).casoParejo).toEqual({ clases: ["eclipsing binary", "RR Lyrae"] });
    expect(adaptarParaReporte(respuesta("alta")).casoParejo).toBeNull();
    expect(adaptarParaReporte(respuesta("baja", ["puntaje_bajo"])).casoParejo).toBeNull();
    const debil = respuesta("media");
    debil.clasificacion.probabilidades = { CEP: 0.1, DSCT: 0.1, ECL: 0.62, LPV: 0.03, RRLYR: 0.15 };
    expect(adaptarParaReporte(debil).casoParejo).toBeNull();
  });

  async function reporteCon(textoLLM) {
    require.cache[rutaRetrieve] = {
      id: rutaRetrieve, filename: rutaRetrieve, loaded: true,
      exports: { retrieveContext: async () => [{ titulo: "p", contenido: "texto" }] },
    };
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: `<report>${textoLLM}</report>` }] }), { status: 200 })
    );
    delete require.cache[rutaFacade];
    const { generarReporte } = require("../ragFacade.js");
    return generarReporte(adaptarParaReporte(respuesta("media")));
  }

  it("si en un caso parejo el reporte elige una clase, se agrega una advertencia", async () => {
    const r = await reporteCon("## Resumen\nLa estrella es probablemente una binaria eclipsante.");
    expect(r.advertencias.join(" ")).toMatch(/Caso parejo/);
  });

  it("si el reporte concluye 'indeterminada', no hay advertencia de caso parejo", async () => {
    const r = await reporteCon("## Resumen\nClasificación indeterminada entre binaria eclipsante y RR Lyrae.");
    expect(r.advertencias.join(" ")).not.toMatch(/Caso parejo/);
  });
});

