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
// ─── Configuración de análisis idioma (navegador) ─────────────────────────────────
export type Idioma = "es" | "en";

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
  /** Fases de Fourier φ21 y φ31 (rad, serie de cosenos como OGLE). */
  phi21?: number | null;
  phi31?: number | null;
  n_atipicos_4sigma: number;
  /** Ausentes en análisis guardados antes de la selección multiarmónica del período. */
  periodo_ls_dias?: number | null;
  metodo_periodo?: "lomb-scargle" | "multiarmonico" | "feets";
  t_valor_minimo?: number | null;
  t_valor_maximo?: number | null;
}

// ─── Clasificador Random Forest (OGLE-III) ───────────────────────────────────

export type ClaseEstrella = "CEP" | "DSCT" | "ECL" | "LPV" | "RRLYR";
export type ConfianzaClasificacion = "alta" | "media" | "baja";
export type AvisoClasificacion = "magnitud_fuera_de_rango" | "periodo_fuera_de_rango" | "puntaje_bajo";

export interface Clasificacion {
  clase: ClaseEstrella;
  segunda_clase: ClaseEstrella;
  /** Puntaje del modelo por clase (no es una probabilidad calibrada). */
  probabilidades: Record<ClaseEstrella, number>;
  confianza: ConfianzaClasificacion;
  avisos: AvisoClasificacion[];
  descriptores: Record<string, number | null>;
  dominio_entrenamiento: Record<string, [number, number]>;
  modelo: {
    algoritmo: string;
    datos_entrenamiento: string;
    clases: ClaseEstrella[];
    f1_macro_prueba: number | null;
    n_entrenamiento: number | null;
    n_prueba: number | null;
  };
}

export interface ResultadoDescriptores {
  n_puntos_recibidos: number;
  n_descartados_faltantes: number;
  n_puntos_usados: number;
  descriptores: Record<string, number | number[] | null>;
  derivados: Derivados;
  /** Ausente en análisis guardados antes de incorporar el clasificador. */
  clasificacion?: Clasificacion | null;
}

// ─── Reporte (RAG) ───────────────────────────────────────────────────────────

export type EstadoReporte = "borrador" | "editado" | "final";

export interface Reporte {
  texto: string;
  fuentes: string[];
  advertencias: string[];
  estado: EstadoReporte;
  idioma?: Idioma;
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
