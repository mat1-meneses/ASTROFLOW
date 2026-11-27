import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Analisis, Reporte } from "../types";
import { generarReporte } from "../api/analisis";
import { plegarEnFase, puntosDesdeSerie, type FaseCero } from "../utils/fase";
import LightCurveChart from "./charts/LightCurveChart";
import PhasedCurveChart from "./charts/PhasedCurveChart";
import DescriptorsPanel from "./DescriptorsPanel";
import ClasificacionPanel from "./ClasificacionPanel";
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
  const [faseCero, setFaseCero] = useState<FaseCero>("maximo");
  const { t_valor_minimo, t_valor_maximo } = resultado.derivados;
  const fase = useMemo(
    () =>
      plegarEnFase(puntos, periodo, configuracion.tipoBrillo, faseCero, {
        tValorMinimo: t_valor_minimo,
        tValorMaximo: t_valor_maximo,
      }),
    [puntos, periodo, configuracion.tipoBrillo, faseCero, t_valor_minimo, t_valor_maximo]
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
    // El navegador propone como nombre del PDF el título de la página.
    const tituloOriginal = document.title;
    document.title = t("impresion.archivo", { nombre: nombre.replace(/\.(csv|txt|dat|tsv|asc)$/i, "") });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    const alTerminar = () => setPrinting(false);
    window.addEventListener("afterprint", alTerminar);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", alTerminar);
      document.title = tituloOriginal;
    };
  }, [printing, nombre, t]);

  if (printing) {
    return (
      <PrintView
        starName={nombre}
        resultado={resultado}
        configuracion={configuracion}
        reporte={reporte}
        analysisDate={analysisDate}
        puntos={puntos}
        fase={fase}
        yLabel={yLabel}
        invertir={invertir}
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
              render={(alto) => (
                <LightCurveChart points={puntos} xLabel={configuracion.mapeo.time} yLabel={yLabel} invertir={invertir} alto={alto} />
              )}
            />
            <ChartCard
              title={t("analisis.graficos.curvaFase")}
              subtitle={
                periodo
                  ? t("analisis.graficos.curvaFaseSub", { periodo: periodo.toFixed(5) })
                  : t("analisis.graficos.sinPeriodo")
              }
              hint={t(faseCero === "maximo" ? "analisis.graficos.curvaFaseHint" : "analisis.graficos.curvaFaseHintMinimo")}
              acciones={periodo ? <SelectorFaseCero valor={faseCero} onChange={setFaseCero} /> : null}
              render={(alto) => <PhasedCurveChart points={fase} yLabel={yLabel} invertir={invertir} alto={alto} />}
            />
          </div>
        </Section>

        <Section title={t("analisis.secciones.clasificacion")} badge={t("analisis.secciones.clasificacionBadge")}>
          <ClasificacionPanel clasificacion={resultado.clasificacion} />
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

interface ChartCardProps {
  title: string;
  subtitle: string;
  hint?: string;
  /** Controles extra junto al botón Ampliar (p. ej. el selector de fase 0). */
  acciones?: React.ReactNode;
  /** Dibuja el gráfico con el alto indicado (270 px en la tarjeta, "100%" ampliado). */
  render: (alto: number | `${number}%`) => React.ReactNode;
}

function ChartCard({ title, subtitle, hint, acciones, render }: ChartCardProps) {
  const { t } = useTranslation();
  const [ampliado, setAmpliado] = useState(false);
  const cerrar = useCallback(() => setAmpliado(false), []);

  return (
    <>
      <div className="bg-astro-surface border border-astro-border rounded-lg p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-astro-text">{title}</h3>
            <p className="text-xs text-astro-muted font-mono mt-0.5">{subtitle}</p>
            {hint && <p className="text-xs text-astro-muted mt-1 opacity-60">{hint}</p>}
          </div>
          <div className="flex-shrink-0 flex items-center gap-2">
          {acciones}
          <button
            type="button"
            onClick={() => setAmpliado(true)}
            title={t("analisis.graficos.ampliar")}
            aria-label={t("analisis.graficos.ampliar")}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs text-astro-muted border border-astro-border rounded px-2.5 py-1.5 hover:text-astro-accent hover:border-astro-accent/50 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            {t("analisis.graficos.ampliar")}
          </button>
          </div>
        </div>
        {render(270)}
      </div>
      {ampliado && (
        <VistaAmpliada title={title} subtitle={subtitle} onClose={cerrar}>
          {render("100%")}
        </VistaAmpliada>
      )}
    </>
  );
}

/** Gráfico a pantalla completa. Esc o el botón Cerrar vuelven a la vista normal. */
function VistaAmpliada({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    // Pantalla completa real si el navegador lo permite; si no, igual cubre toda la ventana.
    el?.requestFullscreen?.().catch(() => {});
    const alSalirDePantallaCompleta = () => {
      if (!document.fullscreenElement) onClose();
    };
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", alSalirDePantallaCompleta);
    window.addEventListener("keydown", alPresionarTecla);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", alSalirDePantallaCompleta);
      window.removeEventListener("keydown", alPresionarTecla);
      document.body.style.overflow = "";
      if (el && document.fullscreenElement === el) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  const cerrar = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onClose();
  };

  return (
    <div ref={ref} className="fixed inset-0 z-50 bg-astro-bg flex flex-col p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-astro-text">{title}</h3>
          <p className="text-xs text-astro-muted font-mono mt-0.5">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={cerrar}
          className="flex-shrink-0 text-sm text-astro-muted border border-astro-border rounded px-3 py-1.5 hover:text-astro-text hover:border-astro-muted transition-colors"
        >
          {t("analisis.graficos.cerrar")}
        </button>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

/** Elige dónde va la fase 0 del gráfico en fase: máximo de brillo (pulsantes) o mínimo (eclipsantes). */
function SelectorFaseCero({ valor, onChange }: { valor: FaseCero; onChange: (v: FaseCero) => void }) {
  const { t } = useTranslation();
  const opciones: FaseCero[] = ["maximo", "minimo"];
  return (
    <div
      role="group"
      aria-label={t("analisis.graficos.faseCero")}
      title={t("analisis.graficos.faseCero")}
      className="flex items-center text-xs border border-astro-border rounded overflow-hidden"
    >
      <span className="px-2 py-1.5 text-astro-muted hidden sm:inline">{t("analisis.graficos.faseCeroCorto")}</span>
      {opciones.map((op) => (
        <button
          key={op}
          type="button"
          aria-pressed={valor === op}
          onClick={() => onChange(op)}
          className={`px-2.5 py-1.5 border-l border-astro-border transition-colors ${
            valor === op ? "bg-astro-accent/15 text-astro-accent" : "text-astro-muted hover:text-astro-text"
          }`}
        >
          {t(op === "maximo" ? "analisis.graficos.faseCeroMaximo" : "analisis.graficos.faseCeroMinimo")}
        </button>
      ))}
    </div>
  );
}
