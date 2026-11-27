// PU-27 — Recuperación: usa embeddings de consulta y ordena por similitud (CU-09, RF-23)
// Usa la base local de Docker con los papers ingestados; la llamada a Voyage se simula.
import { createRequire } from "node:module";
import { afterAll, describe, expect, it, vi } from "vitest";
import { BD_LOCAL } from "../../backend/__tests__/bd.mjs";

const require = createRequire(import.meta.url);

describe.skipIf(!BD_LOCAL)("retrieveContext (base local de Docker)", () => {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await pool.end();
  });

  it("PU-27: pide a Voyage un embedding tipo 'query' y devuelve el top-k de mayor a menor similitud", async () => {
    // Se usa como "consulta" el embedding de un chunk real: ese chunk debe salir primero con similitud ≈ 1.
    const { rows } = await pool.query("SELECT id, embedding::text AS e FROM chunks ORDER BY id LIMIT 1");
    expect(rows).toHaveLength(1);
    const vector = JSON.parse(rows[0].e);

    const pedidos = [];
    vi.stubGlobal("fetch", async (_url, opciones) => {
      pedidos.push(JSON.parse(opciones.body));
      return new Response(JSON.stringify({ data: [{ embedding: vector }] }), { status: 200 });
    });

    const { retrieveContext } = require("../retrieve.js");
    const resultados = await retrieveContext("RR Lyrae light curve", 5);

    expect(pedidos[0]).toMatchObject({ input_type: "query", model: "voyage-4", input: ["RR Lyrae light curve"] });
    expect(resultados).toHaveLength(5);
    expect(resultados[0].similitud).toBeGreaterThan(0.999);
    for (let i = 1; i < resultados.length; i++) {
      expect(resultados[i - 1].similitud).toBeGreaterThanOrEqual(resultados[i].similitud);
    }
    expect(resultados[0]).toHaveProperty("titulo");
    expect(resultados[0]).toHaveProperty("contenido");
  });
});
