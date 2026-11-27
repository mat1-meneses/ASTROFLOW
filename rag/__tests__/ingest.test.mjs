// PU-28 y PU-29 — Ingesta de papers al corpus (CU-13, RF-27)
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const rutaIngest = require.resolve("../ingest.js");
const rutaPg = require.resolve("pg", { paths: [path.dirname(rutaIngest)] });

/** Carga ingest.js con un Pool de Postgres simulado que registra las consultas. */
function cargarIngest(responder) {
  const consultas = [];
  class PoolFalso {
    async query(sql, params) {
      consultas.push(sql);
      return responder(sql, params);
    }
    async connect() {
      throw new Error("No debería abrir una transacción en esta prueba");
    }
    async end() {}
  }
  delete require.cache[rutaIngest];
  require.cache[rutaPg] = { id: rutaPg, filename: rutaPg, loaded: true, exports: { Pool: PoolFalso } };
  return { ingest: require("../ingest.js"), consultas };
}

afterEach(() => {
  vi.restoreAllMocks();
  delete require.cache[rutaIngest];
  delete require.cache[rutaPg];
});

describe("chunkText", () => {
  it("PU-28: divide el texto en el número esperado de fragmentos sin superar 400 palabras", () => {
    const { ingest } = cargarIngest(() => ({ rows: [] }));
    const palabras = Array.from({ length: 1000 }, (_, i) => `p${i}`);
    const chunks = ingest.chunkText(palabras); // 400 palabras con 50 de traslape

    expect(chunks).toHaveLength(3); // empiezan en las palabras 0, 350 y 700
    for (const c of chunks) expect(c.split(" ").length).toBeLessThanOrEqual(400);
    expect(chunks[0].split(" ").slice(-50)).toEqual(chunks[1].split(" ").slice(0, 50)); // traslape
    expect(chunks.at(-1).endsWith("p999")).toBe(true); // cubre el texto completo
  });

  it("PU-28b: la limpieza quita bytes nulos, une palabras cortadas y elimina las referencias", () => {
    const { ingest } = cargarIngest(() => ({ rows: [] }));
    const cuerpo = "Intro\u0000 de la curva de luz con pul-\nsación. ".repeat(20);
    const limpio = ingest.limpiarTexto(`${cuerpo}\nReferences\nSmith, J. (2020). Otro paper.`);

    expect(limpio).not.toContain("\u0000");
    expect(limpio).toContain("pulsación");
    expect(limpio).not.toContain("Smith");
  });
});

describe("ingestPdf", () => {
  it("PU-29: si el paper ya está en el corpus no lo vuelve a insertar y avisa", async () => {
    const { ingest, consultas } = cargarIngest((sql) =>
      /SELECT id FROM documentos/.test(sql) ? { rows: [{ id: 7 }] } : { rows: [] }
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const estado = await ingest.ingestPdf("no-se-lee.pdf", { titulo: "2101.06216v1" });

    expect(estado).toBe("existente");
    expect(consultas.some((sql) => /INSERT/i.test(sql))).toBe(false);
    expect(log.mock.calls.flat().join(" ")).toMatch(/ya ingestado antes \(id=7\)/);
  });
});
