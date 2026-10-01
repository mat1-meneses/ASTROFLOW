// Conversión de las filas leídas (texto) a una serie numérica para el backend.
// Aquí NO se calcula ningún descriptor: solo se extraen columnas y se
// descartan valores faltantes. Todo el cálculo lo hace el microservicio Python.

import { isSentinel } from "../data/parseFile";
import type { Calibracion, ColumnMapping, RawRow, Serie, TipoBrillo } from "../types";

export function extraerSerie(rows: RawRow[], m: ColumnMapping): Serie {
  const serie: Serie = { time: [], magnitude: [], error: [] };

  for (const r of rows) {
    const t = r[m.time];
    const f = r[m.flux];
    const e = r[m.error];
    if ([t, f, e].some((v) => v === undefined || isSentinel(v))) continue;

    const tn = Number(t);
    const fn = Number(f);
    const en = Number(e);
    if (![tn, fn, en].every(Number.isFinite) || en <= 0) continue;

    serie.time.push(tn);
    serie.magnitude.push(fn);
    serie.error.push(en);
  }
  return serie;
}

/** Magnitud o flujo, según el nombre de la columna. Por defecto, magnitud. */
export function inferirTipoBrillo(columna: string): TipoBrillo {
  return /flux|flujo|count|intens|adu/i.test(columna) ? "flujo" : "magnitud";
}

/** Lee la calibración declarada en los comentarios del archivo (ej. MACHO: "# Calibration: instrumental"). */
export function detectarCalibracion(metadata: string[]): Calibracion {
  const texto = metadata.join("\n");
  if (/calibra\w*\s*:\s*instrumental/i.test(texto)) return "instrumental";
  if (/calibra\w*\s*:\s*(standard|est[aá]ndar|calibrated|calibrada)/i.test(texto)) return "estandar";
  return "desconocida";
}

/** Nombre legible a partir del archivo: "9.5482.957.publc.txt" → "9.5482.957.publc". */
export function nombreDesdeArchivo(nombreArchivo: string): string {
  return nombreArchivo.replace(/\.(csv|txt|dat|tsv|asc)$/i, "");
}
