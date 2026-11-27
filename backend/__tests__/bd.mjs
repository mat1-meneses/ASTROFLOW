// Utilidades compartidas por las pruebas que usan la base de datos.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
require("dotenv").config({ quiet: true });

/** Solo se corre contra la base local de Docker, nunca contra Neon. */
export const BD_LOCAL = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

export const CORREO_PRUEBA = "prueba-vitest-%@astroflow.test";
export const correoPrueba = (nombre) => `prueba-vitest-${nombre}-${Date.now()}@astroflow.test`;
