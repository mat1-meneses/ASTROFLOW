import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Analisis, Reporte } from "../types";
import { generarReporte } from "../api/analisis";
import { plegarEnFase, puntosDesdeSerie } from "../utils/fase";
import LightCurveChart from "./charts/LightCurveChart";
import PhasedCurveChart from "./charts/PhasedCurveChart";
import DescriptorsPanel from "./DescriptorsPanel";
import ReportPanel from "./ReportPanel";
import PrintView from "./PrintView";
import UserMenu from "./UserMenu";
import { StarIcon } from "./AppHeader";

export type EstadoGuardado = "sin-guardar" | "guardando" | "guardado" | "error";

interface Props {
  analisis: Analisis;
  onReporteChange: (reporte: Reporte) => void;
  onSave: () => void;
  estadoGuardado: EstadoGuardado;
  mensajeGuardado?: string | null;
  onBack: () => void;
  backLabel: string;
}

export default function AnalysisView({
  analisis,
  onReporteChange,
  onSave,
  estadoGuardado,
  mensajeGuardado,
  onBack,
  backLabel,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "es-CL";
  const idioma = i18n.resolvedLanguage === "en" ? "en" : "es";

  const { nombre, configuracion, serie, resultado, reporte } = analisis;
  const invertir = configuracion.tipoBrillo === "magnitud";
  const yLabel = configuracion.tipoBrillo === "magnitud" ? t("analisis.magnitud") : t("analisis.flujo");
  const periodo = resultado.derivados.periodo_principal_dias;

  const puntos = useMemo(() => puntosDesdeSerie(serie), [serie]);
  const fase = useMemo(
    () => plegarEnFase(puntos, periodo, configuracion.tipoBrillo),
    [puntos, periodo, configuracion.tipoBrillo]
  );

  // ─── Reporte RAG ───────────────────────────────────────────────────────────
  const [cargaReporte, setCargaReporte] = useState<"cargando" | "error" | "listo">(
    reporte ? "listo" : "cargando"
  );
  const [errorReporte, setErrorReporte] = useState<string | null>(null);
  const pedido = useRef(false); // evita pedir el reporte dos veces (StrictMode monta los efectos dos veces en desarrollo)

  const pedirReporte = useCallback(() => {
    setCargaReporte("cargando");
    setErrorReporte(null);
    generarReporte({ resultado, banda: configuracion.banda, calibracion: configuracion.calibracion, idioma })
      .then((r) => {
        onReporteChange(r);
        setCargaReporte("listo");
      })
      .catch((e: Error) => {
        setErrorReporte(e.message);
        setCargaReporte("error");
      });
  }, [resultado, configuracion.banda, configuracion.calibracion, idioma, onReporteChange]);
    
  useEffect(() => {
    if (reporte || pedido.current) return;
    pedido.current = true;
    pedirReporte();
  }, [reporte, pedirReporte]);

  // ─── Exportar PDF ──────────────────────────────────────────────────────────
  const [printing, setPrinting] = useState(false);
  const analysisDate = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  useEffect(() => {
    if (!printing) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    const alTerminar = () => setPrinting(false);
    window.addEventListener("afterprint", alTerminar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", alTerminar);
    };
  }, [printing]);

  if (printing) {
    return (
      <PrintView
        starName={nombre}
        resultado={resultado}
        configuracion={configuracion}
        reporte={reporte}
        analysisDate={analysisDate}
      />
    );
  }

  const descartadosRuido =
    resultado.n_puntos_recibidos - resultado.n_descartados_faltantes - resultado.n_puntos_usados;
  const pipeline = [
    t("analisis.pipeline.obsValidas", { n: serie.time.length, banda: configuracion.banda }),
    t("analisis.pipeline.faltantes", { n: resultado.n_descartados_faltantes }),
    t("analisis.pipeline.ruido", { n: descartadosRuido }),
    t("analisis.pipeline.lomb"),
    t("analisis.pipeline.amplitud"),
    cargaReporte === "listo" ? t("analisis.pipeline.reporteListo") : t("analisis.pipeline.reporteEnCurso"),
  ];

  const textoBotonGuardar = {
    "sin-guardar": t("analisis.guardar.sinGuardar"),
    guardando: t("analisis.guardar.guardando"),
    guardado: t("analisis.guardar.guardado"),
    error: t("analisis.guardar.error"),
  }[estadoGuardado];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-astro-bg/96 backdrop-blur-sm border-b border-astro-border px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button onClick={onBack} className="text-sm text-astro-muted hover:text-astro-text transition-colors flex-shrink-0">
            ← {backLabel}
          </button>
          <div className="w-px h-4 bg-astro-border flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <StarIcon size={14} />
            <span className="font-mono text-sm text-astro-text truncate">{nombre}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setPrinting(true)}
            disabled={cargaReporte === "cargando"}
            title={cargaReporte === "cargando" ? t("analisis.esperaReporte") : undefined}
            className="text-sm font-medium text-astro-text border border-astro-border bg-astro-surface hover:border-astro-indigo/50 hover:text-astro-indigo px-4 py-2 rounded transition-all disabled:opacity-50"
          >
            {t("analisis.exportarPdf")}
          </button>
          <button
            onClick={onSave}
            disabled={estadoGuardado === "guardando" || estadoGuardado === "guardado" || cargaReporte === "cargando"}
            className="bg-astro-accent text-astro-bg font-semibold text-sm px-4 py-2 rounded hover:brightness-110 transition-all disabled:opacity-60"
          >
            {textoBotonGuardar}
          </button>
          <div className="w-px h-4 bg-astro-border mx-2" />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 px-8 py-8 max-w-7xl mx-auto w-full space-y-10">
        {mensajeGuardado && (
          <div className="text-sm text-astro-amber bg-astro-amber/5 border border-astro-amber/20 rounded px-4 py-3">
            {mensajeGuardado}
          </div>
        )}

        <Section title={t("analisis.secciones.pipeline")} badge={t("analisis.secciones.pasos", { count: pipeline.length })}>
          <div className="flex flex-wrap gap-2">
            {pipeline.map((paso) => (
              <div key={paso} className="flex items-center gap-2 bg-astro-surface border border-astro-border rounded px-3 py-2 text-xs">
                <span className="text-astro-green">✓</span>
                <span className="text-astro-text">{paso}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("analisis.secciones.visualizacion")} badge={t("analisis.secciones.visualizacionBadge")}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <ChartCard
              title={t("analisis.graficos.curvaLuz")}
              subtitle={t("analisis.graficos.curvaLuzSub", {
                n: puntos.length,
                x: configuracion.mapeo.time,
                y: configuracion.mapeo.flux,
              })}
              hint={t("analisis.graficos.curvaLuzHint")}
            >
              <LightCurveChart points={puntos} xLabel={configuracion.mapeo.time} yLabel={yLabel} invertir={invertir} />
            </ChartCard>
            <ChartCard
              title={t("analisis.graficos.curvaFase")}
              subtitle={
                periodo
                  ? t("analisis.graficos.curvaFaseSub", { periodo: periodo.toFixed(5) })
                  : t("analisis.graficos.sinPeriodo")
              }
              hint={t("analisis.graficos.curvaFaseHint")}
            >
              <PhasedCurveChart points={fase} yLabel={yLabel} invertir={invertir} />
            </ChartCard>
          </div>
        </Section>

        <Section title={t("analisis.secciones.descriptores")} badge={t("analisis.secciones.descriptoresBadge")}>
          <DescriptorsPanel
            resultado={resultado}
            tipoBrillo={configuracion.tipoBrillo}
            calibracion={configuracion.calibracion}
          />
        </Section>

        <Section title={t("analisis.secciones.reporte")} badge={t("analisis.secciones.reporteBadge")}>
          <ReportPanel
            carga={cargaReporte}
            reporte={reporte}
            error={errorReporte}
            onReintentar={pedirReporte}
            onCambio={onReporteChange}
            idiomaActual={idioma}
          />
        </Section>
      </main>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-base font-semibold text-astro-text">{title}</h2>
        {badge && (
          <span className="text-xs font-mono text-astro-muted bg-astro-surface border border-astro-border rounded px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ChartCard({ title, subtitle, hint, children }: { title: string; subtitle: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-astro-surface border border-astro-border rounded-lg p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-astro-text">{title}</h3>
        <p className="text-xs text-astro-muted font-mono mt-0.5">{subtitle}</p>
        {hint && <p className="text-xs text-astro-muted mt-1 opacity-60">{hint}</p>}
      </div>
      {children}
    </div>
  );
}