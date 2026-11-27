// Tipo de estrella según el clasificador Random Forest entrenado con OGLE-III
// (calculado en el microservicio de descriptores; aquí solo se muestra).
import { useTranslation } from "react-i18next";
import type { Clasificacion, ConfianzaClasificacion } from "../types";

const COLOR_CONFIANZA: Record<ConfianzaClasificacion, string> = {
  alta: "text-astro-green bg-astro-green/10 border-astro-green/20",
  media: "text-astro-amber bg-astro-amber/10 border-astro-amber/20",
  baja: "text-astro-red bg-astro-red/10 border-astro-red/20",
};

export default function ClasificacionPanel({ clasificacion }: { clasificacion?: Clasificacion | null }) {
  const { t } = useTranslation();

  if (!clasificacion) {
    return (
      <div className="bg-astro-surface border border-astro-border rounded-lg p-5 text-sm text-astro-muted">
        {t("clasificacion.noDisponible")}
      </div>
    );
  }

  const { clase, probabilidades, confianza, avisos, modelo } = clasificacion;
  const ordenadas = Object.entries(probabilidades).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-astro-surface border border-astro-border rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <p className="text-xs text-astro-muted uppercase tracking-wider">{t("clasificacion.claseProbable")}</p>
          <p className="text-xl font-semibold text-astro-text mt-1">
            {t(`clasificacion.clases.${clase}`, { defaultValue: clase })}
            <span className="ml-2 text-xs font-mono text-astro-muted">{clase}</span>
          </p>
        </div>
        <span className={`text-xs font-mono px-2 py-1 rounded border ${COLOR_CONFIANZA[confianza]}`}>
          {t("clasificacion.confianza", { nivel: t(`clasificacion.niveles.${confianza}`) })}
        </span>
      </div>

      <div className="space-y-2" role="list" aria-label={t("clasificacion.puntajes")}>
        {ordenadas.map(([codigo, puntaje]) => (
          <div key={codigo} role="listitem" className="flex items-center gap-3 text-xs">
            <span className="w-44 flex-shrink-0 text-astro-text truncate">
              {t(`clasificacion.clases.${codigo}`, { defaultValue: codigo })}
            </span>
            <div className="flex-1 h-2 rounded bg-astro-surface-2 overflow-hidden">
              <div
                className={`h-full rounded ${codigo === clase ? "bg-astro-accent" : "bg-astro-muted/50"}`}
                style={{ width: `${Math.max(puntaje * 100, 1)}%` }}
              />
            </div>
            <span className="w-12 text-right font-mono text-astro-muted">{puntaje.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {avisos.length > 0 && (
        <div className="mt-5 text-xs text-astro-amber bg-astro-amber/5 border border-astro-amber/20 rounded px-3 py-2 space-y-1">
          <p className="font-medium">{t("clasificacion.pocoConfiable")}</p>
          {avisos.map((a) => (
            <p key={a}>· {t(`clasificacion.avisos.${a}`, { defaultValue: a })}</p>
          ))}
        </div>
      )}

      <p className="mt-5 pt-4 border-t border-astro-border text-xs text-astro-muted leading-relaxed">
        {t("clasificacion.modelo", {
          arboles: modelo.algoritmo.match(/\d+/)?.[0] ?? "",
          f1: modelo.f1_macro_prueba != null ? modelo.f1_macro_prueba.toFixed(2) : "—",
        })}
      </p>
    </div>
  );
}
