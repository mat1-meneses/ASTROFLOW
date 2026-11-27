// PU-23 a PU-26 — Fachada del reporte RAG (CU-09, RF-20, RF-23, RNF-08)
// La búsqueda en pgvector y la llamada a Claude se simulan: no se gasta API ni se usa la BD.
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const rutaRetrieve = require.resolve("../retrieve.js");
const rutaFacade = require.resolve("../ragFacade.js");
const { verificarNumeros } = require("../helpersReporte.js");

const DESCRIPTORES = {
  periodo: 0.5667,
  amplitud: 0.3115,
  R21: 0.438,
  R31: 0.329,
  probabilidadFalsaAlarma: 1.18e-58,
  puntosUsados: 401,
  notas: [],
};

const FUENTES = [
  {
    titulo: "paper-rrlyrae",
    contenido: "RR Lyrae stars in the J-VAR DR1 catalogue have periods between 0.4 and 0.8 days.",
  },
];

/** Carga ragFacade con retrieveContext simulado (devuelve siempre las mismas fuentes). */
function cargarFachada(fuentes = FUENTES) {
  delete require.cache[rutaFacade];
  require.cache[rutaRetrieve] = {
    id: rutaRetrieve,
    filename: rutaRetrieve,
    loaded: true,
    exports: { retrieveContext: async () => fuentes },
  };
  return require("../ragFacade.js");
}

/** Simula la respuesta de Claude y guarda lo que se le envió. */
function simularLLM(textoReporte) {
  const enviados = [];
  vi.stubGlobal("fetch", async (_url, opciones) => {
    enviados.push(JSON.parse(opciones.body));
    const text = `<analysis>razonamiento</analysis><report>${textoReporte}</report>`;
    return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
  });
  return enviados;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete require.cache[rutaRetrieve];
  delete require.cache[rutaFacade];
});

describe("generarReporte", () => {
  it("PU-23: el prompt contiene exactamente los valores calculados y la instrucción de no generar números", async () => {
    const { generarReporte } = cargarFachada();
    const enviados = simularLLM("## Resumen\nTexto.");
    await generarReporte(DESCRIPTORES);

    const { system, messages } = enviados[0];
    const mensaje = messages[0].content;
    expect(system).toMatch(/use only the numbers in <descriptors>/);
    expect(system).toMatch(/Never compute new values/);
    expect(mensaje).toContain('"periodo": 0.5667');
    expect(mensaje).toContain('"R21": 0.438');
    expect(mensaje).toContain('"rango_pico_a_pico": 0.623'); // calculado en código, no por el LLM
    expect(mensaje).toContain('"probabilidadFalsaAlarma": "< 0.00001"'); // nunca se muestra como 0
    expect(mensaje).toContain(FUENTES[0].contenido);
  });

  it("PU-24: marca un catálogo con versión equivocada (J-VAR DR3 cuando la fuente dice DR1)", async () => {
    const { generarReporte } = cargarFachada();
    simularLLM("## Resumen\nSegún el catálogo J-VAR DR3 [Fuente 1], el período es 0.5667 d.");
    const r = await generarReporte(DESCRIPTORES);
    expect(r.advertencias).toContain("J-VAR DR3");

    simularLLM("## Resumen\nSegún el catálogo J-VAR DR1 [Fuente 1], el período es 0.5667 d.");
    expect((await generarReporte(DESCRIPTORES)).advertencias).not.toContain("J-VAR DR1");
  });

  it("PU-25: marca números que no están en los descriptores ni en las fuentes", async () => {
    const { generarReporte } = cargarFachada();
    simularLLM("## Resumen\nLa estrella tiene un período de 0.71 d y R21 = 0.438.");
    const r = await generarReporte(DESCRIPTORES);

    expect(r.advertencias).toContain("Número sin respaldo: 0.71");
    expect(r.advertencias.join(" ")).not.toContain("0.438");
  });

  it("PU-26: si el LLM falla, se lanza un error controlado con el código de la API", async () => {
    const { generarReporte } = cargarFachada();
    vi.stubGlobal("fetch", async () => new Response("overloaded", { status: 529 }));
    await expect(generarReporte(DESCRIPTORES)).rejects.toThrow(/Anthropic API error \(529\)/);
  });
});

describe("verificarNumeros", () => {
  it("PU-25b: compara números con descriptores también cuando el texto usa coma decimal", () => {
    const desc = { periodo: 0.566 };
    expect(verificarNumeros("El período es de 0.71 d.", desc, [])).toEqual(["0.71"]);
    expect(verificarNumeros("El período es de 0,71 d.", desc, [])).toEqual(["0.71"]);
    expect(verificarNumeros("El período es de 0,566 d (0.57 redondeado).", desc, [])).toEqual([]);
  });
});

describe("generarReporte — decimales y longitud", () => {
  it("PU-23b: el período y el texto del reporte no superan 5 decimales", async () => {
    const { generarReporte } = cargarFachada();
    const enviados = simularLLM("## Resumen\nEl período es 0.3405706 d y la amplitud 0.12345678 mag.");
    const r = await generarReporte({ ...DESCRIPTORES, periodo: 0.34057058 });

    expect(enviados[0].messages[0].content).toContain('"periodo": 0.34057');
    expect(r.reporte).toContain("0.34057 d");
    expect(r.reporte).toContain("0.12346 mag");
    expect(r.reporte).not.toMatch(/\d\.\d{6,}/);
  });

  it("PU-23c: si Claude corta la respuesta por longitud, el reporte llega con un aviso", async () => {
    const { generarReporte } = cargarFachada();
    vi.stubGlobal("fetch", async () =>
      new Response(JSON.stringify({
        content: [{ type: "text", text: "<report>## Resumen\nTexto cortado a la mi" }],
        stop_reason: "max_tokens",
      }), { status: 200 })
    );
    const r = await generarReporte(DESCRIPTORES);
    expect(r.reporte).toContain("Texto cortado");
    expect(r.advertencias[0]).toMatch(/Reporte incompleto/);
  });
});

describe("buildSystemPrompt — reglas contra comparaciones sin respaldo", () => {
  it("PU-23d: el prompt prohíbe comparar con constantes, aplicar criterios fuera de su rango y ubicar mal un valor en un rango", async () => {
    const { generarReporte } = cargarFachada();
    const enviados = simularLLM("## Resumen\nTexto.");
    await generarReporte(DESCRIPTORES);
    const system = enviados[0].system;
    expect(system).toMatch(/Never compare it with mathematical constants/);
    expect(system).toMatch(/Use a criterion only if the star falls inside the period range/);
    expect(system).toMatch(/check both limits of that range/);
  });
});

describe("callClaude — reproducibilidad", () => {
  it("PU-23e: el reporte se pide con temperatura 0 (misma curva, mismo reporte)", async () => {
    const { generarReporte } = cargarFachada();
    const enviados = simularLLM("## Resumen\nTexto.");
    await generarReporte(DESCRIPTORES);
    expect(enviados[0].temperature).toBe(0);
  });
});

