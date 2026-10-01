// Tipos compartidos de ASTROFLOW.
// Reemplaza al types.ts de Figma: los descriptores ahora vienen del
// microservicio Python (feets), no de datos de ejemplo.

import type { ParseResult } from "./data/parseFile";

// ─── Lectura y mapeo de columnas (navegador) ─────────────────────────────────

export type RawRow = Record<string, string>;
export type ParsedFile = ParseResult;

/** Columna elegida para cada rol. `flux` guarda la columna de brillo (magnitud o flujo). */
export interface ColumnMapping {
  time: string;
  flux: string;
  error: string;
}

export type TipoBrillo = "magnitud" | "flujo";
export type Calibracion = "instrumental" | "estandar" | "desconocida";

/** Serie numérica lista para enviar al backend (sin centinelas ni texto). */
export interface Serie {
  time: number[];
  magnitude: number[];
  error: number[];
}

export interface ConfiguracionAnalisis {
  mapeo: ColumnMapping;
  tipoBrillo: TipoBrillo;
  calibracion: Calibracion;
  banda: string;
}

// ─── Gráficos ─────────────────────────────────────────────────────────────────

export interface LightCurvePoint {
  time: number;
  flux: number;
  error: number;
}

export interface PhasedPoint {
  phase: number;
  flux: number;
}

// ─── Respuesta del microservicio de descriptores ─────────────────────────────

export interface Derivados {
  periodo_principal_dias: number | null;
  prob_falsa_alarma: number | null;
  amplitud_fats: number;
  R21: number | null;
  R31: number | null;
  n_atipicos_4sigma: number;
}

export interface ResultadoDescriptores {
  n_puntos_recibidos: number;
  n_descartados_faltantes: number;
  n_puntos_usados: number;
  descriptores: Record<string, number | number[] | null>;
  derivados: Derivados;
}

// ─── Reporte (RAG) ───────────────────────────────────────────────────────────

export type EstadoReporte = "borrador" | "editado" | "final";

export interface Reporte {
  texto: string;
  fuentes: string[];
  advertencias: string[];
  estado: EstadoReporte;
}

// ─── Análisis completo (en memoria o guardado) ───────────────────────────────

export interface Analisis {
  id?: number; // presente solo si está guardado en la base de datos
  nombre: string;
  configuracion: ConfiguracionAnalisis;
  serie: Serie;
  resultado: ResultadoDescriptores;
  reporte: Reporte | null;
}

/** Fila del historial (panel del usuario). */
export interface ResumenAnalisis {
  id: number;
  nombre: string;
  creadoEn: string;
  nPuntos: number | null;
  periodo: number | null;
  amplitud: number | null;
  R21: number | null;
}
