import type { ColumnMapping, RawRow } from "../types";

export type Confidence = "high" | "medium" | "low" | "none";

export interface DetectionResult {
  mapping: Partial<ColumnMapping>;
  confidence: Record<keyof ColumnMapping, Confidence>;
  notes: string[];
  formatHint?: string;
}

// Known column names by role, ordered by specificity
const TIME_NAMES = [
  "hjd", "bjd", "mjd", "jd", "heliojd", "baryjd",
  "hjd-2450000", "hjd-2400000", "time", "epoch", "date",
  "jd_helio", "jd_bary", "t", "col1", "column1",
];

const FLUX_NAMES = [
  "flux", "flux_r", "flux_b", "flux_v", "flux_i",
  "mag", "magnitude", "rmag", "bmag", "vmag", "imag", "hmag", "kmag",
  "r_mag", "b_mag", "i_mag", "v_mag",
  "imagnitude", "vmagnitude",
  "intensity", "brightness", "counts",
  "diff_flux", "norm_flux",
  "col2", "column2",
];

const ERROR_NAMES = [
  "err", "error", "sigma", "sig",
  "rerr", "berr", "verr", "ierr", "herr",
  "r_err", "b_err", "i_err", "v_err",
  "err_mag", "mag_err", "flux_err", "dflux",
  "uncertainty", "unc", "stddev", "std",
  "dmag", "delta_mag", "e_mag", "e_flux",
  "col3", "column3",
];

// Known survey format signatures
const FORMAT_SIGNATURES: Array<{
  name: string;
  detect: (headers: string[]) => boolean;
  mapping: Partial<ColumnMapping>;
}> = [
  {
    name: "OGLE (HJD / I_mag / err_I)",
    detect: (h) => h.some(c => /^hjd$/i.test(c)) && h.some(c => /^i_?mag$/i.test(c)),
    mapping: {},
  },
  {
    name: "OGLE genérico (hjd, mag, err)",
    detect: (h) => {
      const lc = h.map(s => s.toLowerCase());
      return lc.includes("hjd") && lc.includes("mag") && lc.includes("err");
    },
    mapping: {},
  },
  {
    name: "MACHO (HJD · r/err_r · b/err_b)",
    detect: (h) => {
      const lc = h.map(s => s.toLowerCase());
      const tieneR = lc.includes("r") || lc.includes("rmag") || lc.includes("r_mag");
      const tieneErrR = lc.includes("err_r") || lc.includes("rerr") || lc.includes("r_err");
      return tieneR && tieneErrR;
    },
    mapping: {},
  },
  {
    name: "AAVSO (JD / Magnitude / Uncertainty)",
    detect: (h) => {
      const lc = h.map(s => s.toLowerCase());
      return lc.some(c => c.startsWith("jd")) && lc.includes("magnitude") &&
             lc.includes("uncertainty");
    },
    mapping: {},
  },
];

function lc(s: string) {
  return s.toLowerCase().trim();
}

function scoreColumn(col: string, patterns: string[]): number {
  const c = lc(col);
  for (let i = 0; i < patterns.length; i++) {
    if (c === patterns[i]) return 100 - i;
    if (c.endsWith("_" + patterns[i]) || c.startsWith(patterns[i] + "_")) return 85 - i;
    if (c.startsWith(patterns[i]) || c.endsWith(patterns[i])) return 70 - i;
    if (c.includes(patterns[i])) return 50 - i;
  }
  return 0;
}

function medianValue(vals: number[]): number {
  const sorted = [...vals].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// Numerical heuristics: classify a column's likely role from its values
function numericalRole(vals: number[]): "time" | "flux" | "error" | "unknown" {
  if (vals.length === 0) return "unknown";
  const med = medianValue(vals);
  const spread = Math.max(...vals) - Math.min(...vals);

  // HJD/BJD/MJD are large numbers
  if (med > 1000) return "time";
  // Errors are very small and have low spread
  if (med < 0.5 && spread < 0.5) return "error";
  // Magnitudes are typically 5–25; normalised flux near 1
  if ((med >= 5 && med <= 25) || (med > 0.5 && med < 5 && spread > 0.01)) return "flux";
  return "unknown";
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  if (score > 0) return "low";
  return "none";
}

export function detectColumnMapping(
  headers: string[],
  rows: RawRow[]
): DetectionResult {
  const notes: string[] = [];
  let formatHint: string | undefined;

  // Detect known survey format
  for (const fmt of FORMAT_SIGNATURES) {
    if (fmt.detect(headers)) {
      formatHint = fmt.name;
      notes.push(`Formato reconocido: ${fmt.name}`);
      break;
    }
  }

  // Parse numerical samples for heuristics
  const sampleRows = rows.slice(0, Math.min(20, rows.length));
  const numericalSamples: Record<string, number[]> = {};
  for (const col of headers) {
    numericalSamples[col] = sampleRows
      .map((r) => parseFloat(r[col]))
      .filter((v) => !isNaN(v));
  }

  // Score every column for every role
  // Columnas de identificación o control: nunca son tiempo, brillo ni error.
  const NO_DATOS = /^(obs_?id|id|flag|flags|tran|field|tile|seqn|star|name)$/i;

  const candidates = headers.map((col) => {
    if (NO_DATOS.test(col.trim())) {
      return { col, timeScore: 0, fluxScore: 0, errorScore: 0 };
    }
    const vals = numericalSamples[col] ?? [];
    const numRole = numericalRole(vals);
    return {
      col,
      timeScore: scoreColumn(col, TIME_NAMES) + (numRole === "time" ? 30 : 0),
      fluxScore: scoreColumn(col, FLUX_NAMES) + (numRole === "flux" ? 20 : 0),
      errorScore: scoreColumn(col, ERROR_NAMES) + (numRole === "error" ? 25 : 0),
    };
  });

  // Greedy assignment: pick best per role without reusing columns
  const assigned = new Set<string>();

  function pickBest(role: "timeScore" | "fluxScore" | "errorScore"): {
    col: string;
    score: number;
  } | null {
    const ranked = candidates
      .filter((c) => !assigned.has(c.col))
      .sort((a, b) => b[role] - a[role]);
    const top = ranked[0];
    if (!top || top[role] === 0) return null;
    return { col: top.col, score: top[role] };
  }

  const timeResult = pickBest("timeScore");
  if (timeResult) assigned.add(timeResult.col);

  const fluxResult = pickBest("fluxScore");
  if (fluxResult) assigned.add(fluxResult.col);

  const errorResult = pickBest("errorScore");
  if (errorResult) assigned.add(errorResult.col);

  const mapping: Partial<ColumnMapping> = {};
  if (timeResult) mapping.time = timeResult.col;
  if (fluxResult) mapping.flux = fluxResult.col;
  if (errorResult) mapping.error = errorResult.col;

  // Confidence per field
  const confidence: Record<keyof ColumnMapping, Confidence> = {
    time: timeResult ? confidenceFromScore(timeResult.score) : "none",
    flux: fluxResult ? confidenceFromScore(fluxResult.score) : "none",
    error: errorResult ? confidenceFromScore(errorResult.score) : "none",
  };

  // MACHO: banda R como primaria (menos ruidosa que B en los archivos públicos)
  if (formatHint?.includes("MACHO")) {
    const tiempo = headers.find((h) => /^hjd/i.test(h));
    const rMag = headers.find((h) => /^r(_?mag)?$/i.test(h));
    const rErr = headers.find((h) => /^(r_?err|err_r)$/i.test(h));
    if (tiempo) { mapping.time = tiempo; confidence.time = "high"; }
    if (rMag) { mapping.flux = rMag; confidence.flux = "high"; }
    if (rErr) { mapping.error = rErr; confidence.error = "high"; }
    notes.push("MACHO: se usa la banda R (r / err_r) como primaria. Puedes cambiar a la banda B (b / err_b).");
  }

  // If only 3 columns and nothing detected, assign positionally
  if (headers.length === 3 && !mapping.time && !mapping.flux && !mapping.error) {
    mapping.time = headers[0];
    mapping.flux = headers[1];
    mapping.error = headers[2];
    confidence.time = "low";
    confidence.flux = "low";
    confidence.error = "low";
    notes.push("Sin nombres reconocibles: se asignaron columnas por posición (1=Tiempo, 2=Flujo, 3=Error).");
  }

  return { mapping, confidence, notes, formatHint };
}
