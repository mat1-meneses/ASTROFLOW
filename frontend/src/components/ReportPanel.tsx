// Reporte narrativo generado por el módulo RAG (rag/ragFacade.js) en el backend.
// Reemplaza la plantilla de Figma (generateParagraphs + classifyByPeriod), que
// redactaba texto fijo y afirmaba cosas no calculadas (FAP < 0.001, calibración AAVSO).
import { useRef, useState } from "react";
import type { EstadoReporte, Reporte } from "../types";
import TextoReporte from "./TextoReporte";

interface Props {
  carga: "cargando" | "error" | "listo";
  reporte: Reporte | null;
  error: string | null;
  onReintentar: () => void;
  onCambio: (reporte: Reporte) => void;
}

const BADGE: Record<EstadoReporte, { label: string; cls: string }> = {
  borrador: { label: "BORRADOR", cls: "text-astro-indigo bg-astro-indigo/10 border-astro-indigo/20" },
  editado: { label: "EDITADO MANUALMENTE", cls: "text-astro-amber bg-astro-amber/10 border-astro-amber/20" },
  final: { label: "VERSIÓN FINAL", cls: "text-astro-green bg-astro-green/10 border-astro-green/20" },
};

export default function ReportPanel({ carga, reporte, error, onReintentar, onCambio }: Props) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (carga === "cargando") {
    return (
      <div className="bg-astro-surface border border-astro-border rounded-lg p-6 flex items-center gap-3">
        <svg className="w-4 h-4 text-astro-accent animate-spin flex-shrink-0" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" />
          <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-astro-muted">
          Generando el reporte: se buscan fuentes en la literatura y se redacta a partir de los descriptores calculados.
        </p>
      </div>
    );
  }

  if (carga === "error" || !reporte) {
    return (
      <div className="bg-astro-surface border border-astro-border rounded-lg p-6 space-y-3">
        <p className="text-sm text-astro-red">{error ?? "No se pudo generar el reporte."}</p>
        <button
          onClick={onReintentar}
          className="text-xs font-medium text-astro-text border border-astro-border bg-astro-surface-2 hover:border-astro-accent/50 hover:text-astro-accent px-3 py-1.5 rounded transition-all"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const badge = BADGE[reporte.estado];

  const empezarEdicion = () => {
    setBorrador(reporte.texto);
    setEditando(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const guardarEdicion = () => {
    onCambio({ ...reporte, texto: borrador.trim(), estado: "editado" });
    setEditando(false);
  };

  return (
    <div className="bg-astro-surface border border-astro-border rounded-lg p-6">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <p className="text-xs text-astro-muted max-w-lg leading-relaxed">
          Redactado por un modelo de lenguaje a partir de los descriptores calculados y de fuentes
          científicas recuperadas. Revisa y edita antes de exportar.
        </p>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <span className={`text-xs font-mono px-2 py-1 rounded border ${badge.cls}`}>{badge.label}</span>
          {!editando && (
            <button
              onClick={empezarEdicion}
              className="flex items-center gap-1.5 text-xs font-medium text-astro-text border border-astro-border bg-astro-surface-2 hover:border-astro-accent/50 hover:text-astro-accent px-3 py-1.5 rounded transition-all"
            >
              Editar reporte
            </button>
          )}
        </div>
      </div>

      {reporte.advertencias.length > 0 && (
        <div className="mb-5 text-xs text-astro-amber bg-astro-amber/5 border border-astro-amber/20 rounded px-3 py-2">
          Citas sin respaldo en las fuentes recuperadas: {reporte.advertencias.join(", ")}. Verifícalas antes de usar el reporte.
        </div>
      )}

      <div className="border-t border-astro-border pt-5">
        {editando ? (
          <div className="space-y-3">
            <p className="text-xs text-astro-muted">
              Usa una línea en blanco para separar párrafos. Puedes usar **negrita** y títulos con #.
            </p>
            <textarea
              ref={textareaRef}
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              rows={16}
              className="w-full bg-astro-surface-2 border border-astro-accent/40 rounded-lg px-4 py-3 text-sm text-astro-text leading-relaxed font-sans resize-y focus:outline-none focus:border-astro-accent transition-colors"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={guardarEdicion}
                className="bg-astro-accent text-astro-bg font-semibold text-xs px-4 py-2 rounded hover:brightness-110 transition-all"
              >
                Guardar cambios
              </button>
              <button
                onClick={() => setEditando(false)}
                className="text-xs text-astro-muted hover:text-astro-text transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <TextoReporte
              texto={reporte.texto}
              clases={{
                titulo: "text-sm font-semibold text-astro-text mt-2",
                parrafo: "text-sm text-astro-text/90 leading-relaxed",
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-astro-border space-y-3">
        {reporte.fuentes.length > 0 && (
          <p className="text-xs text-astro-muted">
            <span className="text-astro-text font-medium">Fuentes recuperadas: </span>
            <span className="font-mono">{reporte.fuentes.join(", ")}</span>
          </p>
        )}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-astro-muted">
            Texto orientativo. Requiere validación de un astrónomo antes de publicarse.
          </p>
          {!editando && reporte.estado !== "final" && (
            <button
              onClick={() => onCambio({ ...reporte, estado: "final" })}
              className="text-xs text-astro-muted border border-astro-border rounded px-3 py-1.5 hover:border-astro-green/40 hover:text-astro-green transition-all"
            >
              Marcar como versión final
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
