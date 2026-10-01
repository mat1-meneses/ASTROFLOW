// Llamadas al backend Express. Todas pasan por el proxy de Vite (/api → :3000).

import type {
  Analisis,
  Calibracion,
  Reporte,
  ResultadoDescriptores,
  ResumenAnalisis,
  Serie,
} from "../types";

async function pedir<T>(url: string, opciones: RequestInit = {}): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...opciones,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.");
  }
  const cuerpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(cuerpo.error ?? `Error del servidor (${resp.status}).`);
  return cuerpo as T;
}

export function calcularDescriptores(serie: Serie) {
  return pedir<ResultadoDescriptores>("/api/analisis/descriptores", {
    method: "POST",
    body: JSON.stringify(serie),
  });
}

export async function generarReporte(datos: {
  resultado: ResultadoDescriptores;
  banda: string;
  calibracion: Calibracion;
}): Promise<Reporte> {
  const r = await pedir<{ texto: string; fuentes: string[]; advertencias: string[] }>(
    "/api/analisis/reporte",
    { method: "POST", body: JSON.stringify(datos) }
  );
  return { ...r, estado: "borrador" };
}

export function guardarAnalisis(analisis: Analisis) {
  const datos = { ...analisis };
  delete datos.id; // el id lo asigna la base de datos
  return pedir<{ id: number }>("/api/analisis", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export function listarAnalisis() {
  return pedir<{ analisis: ResumenAnalisis[] }>("/api/analisis");
}

export function obtenerAnalisis(id: number) {
  return pedir<Analisis>(`/api/analisis/${id}`);
}
