import { useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { ColumnMapping, ParsedFile } from "../types";
import { isSentinel } from "../data/parseFile";
import { detectColumnMapping, esMapeoValido, type Confidence } from "../utils/detectColumns";
import AppHeader from "./AppHeader";

interface Props {
  parsedFile: ParsedFile;
  starName: string;
  onConfirm: (mapping: ColumnMapping) => void;
  onBack: () => void;
}

type MappingKey = keyof ColumnMapping;

// Los textos (label, hint) se traducen en el render con t(`columnas.campos.${key}.label`)
const FIELD_META: Record<MappingKey, { accentClass: string; tag: string }> = {
  time: {
    accentClass: "text-astro-accent border-astro-accent/30 bg-astro-accent/5",
    tag: "T",
  },
  flux: {
    accentClass: "text-astro-indigo border-astro-indigo/30 bg-astro-indigo/5",
    tag: "F",
  },
  error: {
    accentClass: "text-astro-green border-astro-green/30 bg-astro-green/5",
    tag: "σ",
  },
};

// El texto se traduce en el render con t(`columnas.confianza.${conf}`)
const CONFIDENCE_CLS: Record<Confidence, string> = {
  high: "text-astro-green bg-astro-green/10 border-astro-green/20",
  medium: "text-astro-amber bg-astro-amber/10 border-astro-amber/20",
  low: "text-astro-muted bg-astro-surface-2 border-astro-border",
  none: "text-astro-red bg-astro-red/10 border-astro-red/20",
};

export default function ColumnMappingStep({ parsedFile, starName, onConfirm, onBack }: Props) {
  const { t } = useTranslation();
  const { headers, rows, metadata, headerSource, sentinelColumns } = parsedFile;

  const detection = useMemo(
    () => detectColumnMapping(headers, rows),
    [headers, rows]
  );

  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(detection.mapping);
  const [overridden, setOverridden] = useState<Set<MappingKey>>(new Set());
  const [metaOpen, setMetaOpen] = useState(false);

  const isValid = esMapeoValido(mapping);

  const previewRows = rows.slice(0, 7);
  const validCount = rows.filter((r) => {
    const tv = r[mapping.time ?? ""];
    const fv = r[mapping.flux ?? ""];
    return tv && fv && !isSentinel(tv) && !isSentinel(fv);
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
          {t("columnas.volver")}
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-astro-text mb-1">{t("columnas.titulo")}</h1>
          <p className="text-sm text-astro-muted">
            <Trans
              i18nKey="columnas.descripcion"
              values={{ estrella: starName }}
              components={{ code: <span className="font-mono text-astro-text" /> }}
            />
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
                  <span className="text-astro-text font-medium">{t("columnas.formatoDetectado")} </span>
                  {t(`columnas.formatos.${detection.formatHint}`)}
                </p>
              )}
              {headerSource === "generated" && (
                <p>{t("columnas.sinEncabezado")}</p>
              )}
              {detection.notes.map((n) => (
                <p key={n}>{t(`columnas.notas.${n}`)}</p>
              ))}
              {sentinelColumns.size > 0 && (
                <p className="text-astro-amber">
                  {t("columnas.centinelas", { columnas: [...sentinelColumns].join(", ") })}
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
                  {t("columnas.metadatos")}
                </span>
                <span className="text-xs font-mono text-astro-muted">
                  {t("columnas.lineas", { count: metadata.length })}
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
            const conf: Confidence = overridden.has(key)
              ? selected ? "high" : "none"
              : detection.confidence[key];

            return (
              <div key={key} className="bg-astro-surface border border-astro-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded border ${meta.accentClass}`}>
                      {meta.tag}
                    </span>
                    <span className="text-xs font-semibold text-astro-text uppercase tracking-wider">
                      {t(`columnas.campos.${key}.label`)}
                    </span>
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${CONFIDENCE_CLS[conf]}`}>
                    {t(`columnas.confianza.${conf}`)}
                  </span>
                </div>

                <p className="text-xs text-astro-muted mb-3">{t(`columnas.campos.${key}.hint`)}</p>

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
                  <option value="">{t("columnas.seleccionar")}</option>
                  {headers.map((col) => {
                    const takenBy = columnRole(col);
                    const isMine = takenBy === key;
                    const disabled = !!takenBy && !isMine;
                    return (
                      <option key={col} value={col} disabled={disabled}>
                        {col}
                        {isMine ? " ✓" : disabled && takenBy ? ` (→ ${FIELD_META[takenBy].tag})` : ""}
                        {sentinelColumns.has(col) ? ` ${t("columnas.opcionCentinelas")}` : ""}
                      </option>
                    );
                  })}
                </select>

                {selected && (
                  <p className={`mt-2 text-xs font-mono ${meta.accentClass.split(" ")[0]}`}>
                    {overridden.has(key) ? t("columnas.modificado") : t("columnas.autodetectado")}: {selected}
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
              {t("columnas.vistaPrevia", {
                mostradas: previewRows.length,
                total: rows.length,
                columnas: headers.length,
              })}
            </h2>
            {mapping.time && mapping.flux && (
              <span className="text-xs font-mono text-astro-muted">
                {t("columnas.obsValidas", { count: validCount })}
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
                          title={isMissing ? t("columnas.valorCentinela") : undefined}
                        >
                          {isMissing ? t("columnas.sinDato") : val}
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
              {t("columnas.sinAsignar")}
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
            {t("columnas.confirmar")}
          </button>
          {!isValid && (
            <p className="text-xs text-astro-muted">{t("columnas.asignaTres")}</p>
          )}
          {isValid && (
            <p className="text-xs text-astro-muted">
              {overridden.size === 0
                ? t("columnas.deteccionAceptada")
                : t("columnas.modificados", { count: overridden.size })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}