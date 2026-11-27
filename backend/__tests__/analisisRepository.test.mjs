// PU-19 — Los análisis quedan asociados a su usuario y aislados entre usuarios (CU-12, RF-26)
import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";
import { BD_LOCAL, CORREO_PRUEBA, correoPrueba } from "./bd.mjs";

const require = createRequire(import.meta.url);

const analisisDePrueba = (nombre) => ({
  nombre,
  configuracion: { mapeo: { time: "HJD", flux: "r", error: "err_r" }, tipoBrillo: "magnitud" },
  serie: { time: [1, 2, 3], magnitude: [15.1, 15.2, 15.3], error: [0.02, 0.02, 0.02] },
  resultado: { n_puntos_usados: 3, derivados: { periodo_principal_dias: 0.5667, amplitud_fats: 0.31, R21: 0.43 } },
  reporte: null,
});

describe.skipIf(!BD_LOCAL)("analisisRepository (base local de Docker)", () => {
  const usuarios = require("../repositories/usuarioRepository.js");
  const repo = require("../repositories/analisisRepository.js");
  const { pool } = require("../db.js");

  afterAll(async () => {
    await pool.query("DELETE FROM usuarios WHERE email LIKE $1", [CORREO_PRUEBA]); // borra sus análisis en cascada
    await pool.end();
  });

  it("PU-19: el usuario A ve sus 2 análisis; el usuario B no ve, no abre ni borra ninguno", async () => {
    const a = await usuarios.crear({ nombre: "A", email: correoPrueba("a"), passwordHash: "x" });
    const b = await usuarios.crear({ nombre: "B", email: correoPrueba("b"), passwordHash: "x" });

    const { id: id1 } = await repo.crear({ usuarioId: a.id, ...analisisDePrueba("curva-1") });
    await repo.crear({ usuarioId: a.id, ...analisisDePrueba("curva-2") });

    expect(await repo.listarPorUsuario(b.id)).toHaveLength(0);
    const deA = await repo.listarPorUsuario(a.id);
    expect(deA).toHaveLength(2);
    expect(deA[0]).toMatchObject({ nPuntos: 3, periodo: 0.5667 });

    expect(await repo.obtenerDeUsuario(id1, b.id)).toBeNull(); // B no puede abrir el de A
    expect(await repo.eliminarDeUsuario(id1, b.id)).toBe(false); // ni borrarlo
    expect(await repo.eliminarDeUsuario(id1, a.id)).toBe(true); // A sí
    expect(await repo.listarPorUsuario(a.id)).toHaveLength(1);
  });
});
