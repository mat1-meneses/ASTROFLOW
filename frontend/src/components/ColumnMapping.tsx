import { useMemo, useState } from "react";
import type { ColumnMapping, ParsedFile } from "../types";
import { isSentinel } from "../data/parseFile";
import { detectColumnMapping, type Confidence } from "../utils/detectColumns";
import AppHeader from "./AppHeader";

interface Props {
  parsedFile: ParsedFile;
  starName: string;
  onConfirm: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

type MappingKey = keyof ColumnMapping;

const FIELD_META: Record<
  MappingKey,
  { label: string; hint: string; accentClass: string; tag: string }
> = {
  time: {
    label: "Tiempo",
    hint: "HJD, BJD, MJD o días desde época",
    accentClass: "text-astro-accent border-astro-accent/30 bg-astro-accent/5",
    tag: "T",
  },
  flux: {
    label: "Magnitud / Flujo",
    hint: "Magnitud (instrumental o calibrada) o flujo",
    accentClass: "text-astro-indigo border-astro-indigo/30 bg-astro-indigo/5",
    tag: "F",
  },
  error: {
    label: "Error / Incertidumbre",
    hint: "Desviación estándar fotométrica (σ)",
    accentClass: "text-astro-green border-astro-green/30 bg-astro-green/5",
    tag: "σ",
  },
};

const CONFIDENCE_LABEL: Record<Confidence, { text: string; cls: string }> = {
  high: { text: "Alta confianza", cls: "text-astro-green bg-astro-green/10 border-astro-green/20" },
  medium: { text: "Confianza media", cls: "text-astro-amber bg-astro-amber/10 border-astro-amber/20" },
  low: { text: "Baja confianza", cls: "text-astro-muted bg-astro-surface-2 border-astro-border" },
  none: { text: "No detectada", cls: "text-astro-red bg-astro-red/10 border-astro-red/20" },
};

export default function ColumnMappingStep({ parsedFile, starName, onConfirm, onBack }: Props) {
  const { headers, rows, metadata, headerSource, sentinelColumns } = parsedFile;

  const detection = useMemo(
    () => detectColumnMapping(headers, rows),
    [headers, rows]
  );

  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(detection.mapping);
  const [overridden, setOverridden] = useState<Set<MappingKey>>(new Set());
  const [metaOpen, setMetaOpen] = useState(false);

  const isValid =
    !!mapping.time &&
    !!mapping.flux &&
    !!mapping.error &&
    new Set([mapping.time, mapping.flux, mapping.error]).size === 3;

  const previewRows = rows.slice(0, 7);
  const validCount = rows.filter((r) => {
    const t = r[mapping.time ?? ""];
    const f = r[mapping.flux ?? ""];
    return t && f && !isSentinel(t) && !isSentinel(f);
  }).length;

  const handleChange = (key: MappingKey, value: string) => {
    setMapping((prev) => ({ ...prev, [key]: value || undefined }));
    setOverridden((prev) => {
      const next = new Set(prev);
      value ? next.add(key) : next.delete(key);
      return next;
    });
  };

  const columnRole = (col: string): MappingKey | null => {
    for (const [k, v] of Object.entries(mapping)) {
      if (v === col) return k as MappingKey;
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-astro-muted hover:text-astro-text mb-8 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver a carga
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-astro-text mb-1">Mapeo de columnas</h1>
          <p className="text-sm text-astro-muted">
            Columnas detectadas automáticamente para{" "}
            <span className="font-mono text-astro-text">{starName}</span>.
            Corrige cualquier asignación si es necesario.
          </p>
        </div>

        {/* Detection banner */}
        {(detection.formatHint || detection.notes.length > 0) && (
          <div className="mb-5 bg-astro-surface border border-astro-border rounded-lg px-4 py-3 flex items-start gap-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              className="text-astro-accent flex-shrink-0 mt-0.5">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7 5v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <div className="text-xs text-astro-muted space-y-0.5">
              {detection.formatHint && (
                <p>
                  <span className="text-astro-text font-medium">Formato detectado: </span>
                  {detection.formatHint}
                </p>
              )}
              {headerSource === "generated" && (
                <p>Sin encabezado de columnas en el archivo — se generaron nombres automáticos (Col1, Col2…).</p>
              )}
              {detection.notes.filter((n) => !n.startsWith("Formato")).map((n, i) => (
                <p key={i}>{n}</p>
              ))}
              {sentinelColumns.size > 0 && (
                <p className="text-astro-amber">
                  Valores centinela detectados (−99, NaN, etc.) en:{" "}
                  {[...sentinelColumns].join(", ")} — se excluirán del análisis.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Metadata panel */}
        {metadata.length > 0 && (
          <div className="mb-5 border border-astro-border rounded-lg overflow-hidden">
            <button
              onClick={() => setMetaOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-astro-surface hover:bg-astro-surface-2 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                  className="text-astro-muted">
                  <rect x="1" y="2" width="10" height="1.2" rx="0.6" fill="currentColor" />
                  <rect x="1" y="5.4" width="7" height="1.2" rx="0.6" fill="currentColor" />
                  <rect x="1" y="8.8" width="8.5" height="1.2" rx="0.6" fill="currentColor" />
                </svg>
                <span className="text-xs font-medium text-astro-text">
                  Metadatos del archivo
                </span>
                <span className="text-xs font-mono text-astro-muted">
                  {metadata.length} línea{metadata.length !== 1 ? "s" : ""}
                </span>
              </div>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                className={`text-astro-muted transition-transform ${metaOpen ? "rotate-180" : ""}`}
              >
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.2"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {metaOpen && (
              <div className="border-t border-astro-border bg-astro-bg px-4 py-3">
                {metadata.map((line, i) => (
                  <p key={i} className="text-xs font-mono text-astro-muted leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Field cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {(["time", "flux", "error"] as MappingKey[]).map((key) => {
            const meta = FIELD_META[key];
            const selected = mapping[key];
            const conf = overridden.has(key)
              ? selected ? "high" : "none"
              : detection.confidence[key];
            const confLabel = CONFIDENCE_LABEL[conf];

            return (
              <div key={key} className="bg-astro-surface border border-astro-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded border ${meta.accentClass}`}>
                      {meta.tag}
                    </span>
                    <span className="text-xs font-semibold text-astro-text uppercase tracking-wider">
                      {meta.label}
                    </span>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${confLabel.cls}`}>
                    {confLabel.text}
                  </span>
                </div>

                <p className="text-xs text-astro-muted mb-3">{meta.hint}</p>

                <select
                  value={selected ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={`
                    w-full bg-astro-surface-2 border rounded px-3 py-2 text-sm
                    focus:outline-none transition-colors
                    ${selected
                      ? "border-astro-border text-astro-text focus:border-astro-accent"
                      : "border-astro-red/40 text-astro-muted focus:border-astro-accent"
                    }
                  `}
                >
                  <option value="">— Seleccionar columna —</option>
                  {headers.map((col) => {
                    const takenBy = columnRole(col);
                    const isMine = takenBy === key;
                    const disabled = !!takenBy && !isMine;
                    return (
                      <option key={col} value={col} disabled={disabled}>
                        {col}
                        {isMine ? " ✓" : disabled && takenBy ? ` (→ ${FIELD_META[takenBy].tag})` : ""}
                        {sentinelColumns.has(col) ? " ⚠ centinelas" : ""}
                      </option>
                    );
                  })}
                </select>

                {selected && (
                  <p className={`mt-2 text-xs font-mono ${meta.accentClass.split(" ")[0]}`}>
                    {overridden.has(key) ? "✎ Modificado" : "✓ Auto-detectado"}: {selected}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Table preview */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-medium text-astro-muted uppercase tracking-wider">
              Vista previa — {previewRows.length} de {rows.length} filas · {headers.length} columnas
            </h2>
            {mapping.time && mapping.flux && (
              <span className="text-xs font-mono text-astro-muted">
                {validCount} obs. válidas tras excluir centinelas
              </span>
            )}
          </div>

          <div className="overflow-x-auto border border-astro-border rounded-lg">
            <table className="w-full text-xs font-mono">
              <thead className="bg-astro-surface-2">
                <tr>
                  {headers.map((col) => {
                    const role = columnRole(col);
                    return (
                      <th
                        key={col}
                        className={`
                          px-4 py-3 text-left font-medium border-b border-astro-border whitespace-nowrap
                          ${role ? FIELD_META[role].accentClass.split(" ")[0] : "text-astro-muted"}
                        `}
                      >
                        {col}
                        {role && <span className="ml-1.5 opacity-60">[{FIELD_META[role].tag}]</span>}
                        {sentinelColumns.has(col) && (
                          <span className="ml-1 text-astro-amber opacity-80">⚠</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-astro-border/40 hover:bg-astro-surface-2/60 transition-colors last:border-b-0"
                  >
                    {headers.map((col) => {
                      const role = columnRole(col);
                      const val = row[col] ?? "";
                      const isMissing = isSentinel(val);
                      return (
                        <td
                          key={col}
                          className={`px-4 py-2.5 ${
                            isMissing
                              ? "text-astro-amber/60 italic"
                              : role
                              ? `${FIELD_META[role].accentClass.split(" ")[0]} opacity-80`
                              : "text-astro-text/50"
                          }`}
                          title={isMissing ? "Valor centinela — sin dato" : undefined}
                        >
                          {isMissing ? "— sin dato" : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {headers.length > 3 && (
            <p className="mt-2 text-xs text-astro-muted">
              Las columnas sin asignar (posibles bandas secundarias) no se usan en este análisis.
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            disabled={!isValid}
            onClick={() => isValid && onConfirm(mapping as ColumnMapping)}
            className={`
              px-6 py-2.5 rounded font-semibold text-sm transition-all
              ${isValid
                ? "bg-astro-accent text-astro-bg hover:brightness-110 cursor-pointer"
                : "bg-astro-surface border border-astro-border text-astro-muted cursor-not-allowed"
              }
            `}
          >
            Confirmar y analizar →
          </button>
          {!isValid && (
            <p className="text-xs text-astro-muted">Asigna las tres columnas para continuar.</p>
          )}
          {isValid && (
            <p className="text-xs text-astro-muted">
              {overridden.size === 0
                ? "Detección automática aceptada."
                : `${overridden.size} campo${overridden.size > 1 ? "s" : ""} modificado${overridden.size > 1 ? "s" : ""} manualmente.`}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
