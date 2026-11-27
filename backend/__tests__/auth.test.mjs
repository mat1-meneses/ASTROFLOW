// PU-16, PU-17 y PU-18 — Autenticación (CU-01, RF-26)
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BD_LOCAL, CORREO_PRUEBA, correoPrueba } from "./bd.mjs";

const require = createRequire(import.meta.url);
process.env.JWT_SECRET ||= "secreto-solo-para-pruebas";

let servidor;
let base;

beforeAll(async () => {
  const app = require("../server.js");
  await new Promise((listo) => {
    servidor = app.listen(0, listo); // puerto libre al azar
  });
  base = `http://127.0.0.1:${servidor.address().port}`;
});

afterAll(async () => {
  await new Promise((listo) => servidor.close(listo));
});

const post = (ruta, cuerpo) =>
  fetch(base + ruta, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });

describe("Middleware requerirSesion", () => {
  it("PU-18: una ruta protegida sin sesión responde 401", async () => {
    const r = await fetch(`${base}/api/analisis`);
    expect(r.status).toBe(401);
    expect((await r.json()).error).toMatch(/iniciar sesión/i);
  });

  it("PU-18b: un token alterado se trata como invitado (401)", async () => {
    const r = await fetch(`${base}/api/analisis`, { headers: { cookie: "astroflow_sesion=token.falso.123" } });
    expect(r.status).toBe(401);
  });
});

describe.skipIf(!BD_LOCAL)("Registro e inicio de sesión (base local de Docker)", () => {
  let pool;

  beforeAll(() => {
    ({ pool } = require("../db.js"));
  });

  afterAll(async () => {
    await pool.query("DELETE FROM usuarios WHERE email LIKE $1", [CORREO_PRUEBA]);
    await pool.end();
  });

  it("PU-16: credenciales válidas entregan una sesión; inválidas responden 401", async () => {
    const email = correoPrueba("login");
    const registro = await post("/api/auth/registro", { nombre: "Prueba", email, password: "clave-segura-123" });
    expect(registro.status).toBe(201);

    const ok = await post("/api/auth/login", { email, password: "clave-segura-123" });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/astroflow_sesion=.+; .*HttpOnly/i);

    // Con la cookie recibida, la ruta protegida ya responde
    const cookie = ok.headers.get("set-cookie").split(";")[0];
    expect((await fetch(`${base}/api/analisis`, { headers: { cookie } })).status).toBe(200);

    const mal = await post("/api/auth/login", { email, password: "contraseña-incorrecta" });
    expect(mal.status).toBe(401);
    expect(mal.headers.get("set-cookie")).toBeNull();
  });

  it("PU-17: la contraseña se guarda como hash bcrypt, nunca en texto plano", async () => {
    const email = correoPrueba("hash");
    const password = "otra-clave-456";
    expect((await post("/api/auth/registro", { nombre: "Prueba", email, password })).status).toBe(201);

    const { rows } = await pool.query("SELECT password_hash FROM usuarios WHERE email = $1", [email]);
    expect(rows[0].password_hash).not.toContain(password);
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/); // bcrypt con costo 12
  });
});
