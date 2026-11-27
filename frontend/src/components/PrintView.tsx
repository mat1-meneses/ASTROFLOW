import { Trans, useTranslation } from "react-i18next";
import type { ConfiguracionAnalisis, LightCurvePoint, PhasedPoint, Reporte, ResultadoDescriptores } from "../types";
import LightCurveChart from "./charts/LightCurveChart";
import PhasedCurveChart from "./charts/PhasedCurveChart";
import { filasDescriptores } from "../utils/filasDescriptores";
import TextoReporte from "./TextoReporte";

interface Props {
  starName: string;
  resultado: ResultadoDescriptores;
  configuracion: ConfiguracionAnalisis;
  reporte: Reporte | null;
  analysisDate: string;
  puntos: LightCurvePoint[];
  fase: PhasedPoint[];
  yLabel: string;
  invertir: boolean;
}

// Ancho útil de una hoja A4 con márgenes de 2,5 cm (≈ 16 cm a 96 ppp).
const ANCHO_GRAFICO = 600;
const ALTO_GRAFICO = 250;

/**
 * Vista de impresión (Exportar PDF). Usa solo estilos en línea para no depender de Tailwind.
 * El reporte se renderiza con TextoReporte (sin innerHTML).
 */
export default function PrintView({ starName, resultado, configuracion, reporte, analysisDate, puntos, fase, yLabel, invertir }: Props) {
  const { t } = useTranslation();

  const rows = filasDescriptores(resultado, configuracion.tipoBrillo, configuracion.calibracion, t).map((f) => ({
    param: f.parametro,
    value: f.unidad === "—" ? f.valor : `${f.valor} ${f.unidad}`,
    method: f.metodo,
  }));

  const s = {
    wrap: { fontFamily: "Georgia, serif", color: "#111", lineHeight: "1.55", fontSize: "12pt" } as React.CSSProperties,
    header: { borderBottom: "2px solid #111", paddingBottom: "10pt", marginBottom: "18pt", display: "flex", justifyContent: "space-between", alignItems: "flex-end" } as React.CSSProperties,
    logo: { fontFamily: "Arial, sans-serif", fontSize: "16pt", fontWeight: 700, letterSpacing: "3pt" } as React.CSSProperties,
    meta: { textAlign: "right" as const, fontSize: "9pt", color: "#444" },
    starName: { fontSize: "13pt", fontWeight: 700, color: "#111", marginBottom: "3pt" },
    sectionTitle: { fontSize: "13pt", fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: "4pt", marginTop: "22pt", marginBottom: "10pt" } as React.CSSProperties,
    table: { width: "100%", borderCollapse: "collapse" as const, fontSize: "10pt", marginBottom: "16pt" },
    th: { textAlign: "left" as const, borderBottom: "1px solid #888", padding: "5pt 8pt", fontFamily: "Arial, sans-serif", fontSize: "9pt", color: "#555", textTransform: "uppercase" as const, letterSpacing: "0.5pt" },
    td: { padding: "5pt 8pt", borderBottom: "1px solid #ddd", verticalAlign: "top" as const },
    tdVal: { padding: "5pt 8pt", borderBottom: "1px solid #ddd", fontFamily: "monospace", fontWeight: 700 },
    tdMethod: { padding: "5pt 8pt", borderBottom: "1px solid #ddd", color: "#555", fontSize: "9pt", fontFamily: "monospace" },
    report: { fontSize: "11pt", lineHeight: "1.65", marginBottom: "8pt" } as React.CSSProperties,
    figura: { marginBottom: "14pt", breakInside: "avoid", pageBreakInside: "avoid" } as React.CSSProperties,
    figuraTitulo: { fontFamily: "Arial, sans-serif", fontSize: "10pt", fontWeight: 700, marginBottom: "2pt" } as React.CSSProperties,
    figuraSub: { fontFamily: "monospace", fontSize: "8.5pt", color: "#555", marginBottom: "6pt" } as React.CSSProperties,
    disclaimer: { textAlign: "justify", marginTop: "24pt", padding: "10pt", border: "1px solid #ccc", fontSize: "9pt", color: "#555", backgroundColor: "#f9f9f9" } as React.CSSProperties,
    footer: { marginTop: "16pt", fontSize: "8pt", color: "#aaa", textAlign: "center" as const, borderTop: "1px solid #eee", paddingTop: "8pt" } as React.CSSProperties,
  };

  return (
    <div id="astroflow-print" style={s.wrap}>
      <div style={s.header}>
        <div style={s.logo}>ASTROFLOW</div>
        <div style={s.meta}>
          <div style={s.starName}>{starName}</div>
          <div>{t("impresion.generado", { fecha: analysisDate })}</div>
          <div>
            {t("impresion.bandaCalibracion", {
              banda: configuracion.banda,
              calibracion: configuracion.calibracion,
            })}
          </div>
          <div style={{ marginTop: "2pt" }}>{t("impresion.prototipo")}</div>
        </div>
      </div>

      {resultado.clasificacion && (
        <>
          <div style={s.sectionTitle}>{t("analisis.secciones.clasificacion")}</div>
          <p style={{ margin: "0 0 6pt" }}>
            <strong>
              {t(`clasificacion.clases.${resultado.clasificacion.clase}`)} ({resultado.clasificacion.clase})
            </strong>
            {" · "}
            {t("clasificacion.confianza", { nivel: t(`clasificacion.niveles.${resultado.clasificacion.confianza}`) })}
          </p>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t("clasificacion.clase")}</th>
                <th style={s.th}>{t("clasificacion.puntaje")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(resultado.clasificacion.probabilidades)
                .sort((a, b) => b[1] - a[1])
                .map(([codigo, puntaje]) => (
                  <tr key={codigo}>
                    <td style={s.td}>{t(`clasificacion.clases.${codigo}`)}</td>
                    <td style={s.tdVal}>{puntaje.toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {resultado.clasificacion.avisos.length > 0 && (
            <p style={{ fontSize: "9pt", color: "#8a5a00", margin: "0 0 6pt" }}>
              {t("clasificacion.pocoConfiable")}{" "}
              {resultado.clasificacion.avisos.map((a) => t(`clasificacion.avisos.${a}`)).join(" ")}
            </p>
          )}
          <p style={{ fontSize: "8.5pt", color: "#555", margin: "0 0 12pt", textAlign: "justify" }}>
            {t("clasificacion.modelo", {
              arboles: resultado.clasificacion.modelo.algoritmo.match(/\d+/)?.[0] ?? "",
              f1: resultado.clasificacion.modelo.f1_macro_prueba?.toFixed(2) ?? "—",
            })}
          </p>
        </>
      )}

      <div style={s.sectionTitle}>{t("impresion.descriptores")}</div>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>{t("descriptores.columnas.parametro")}</th>
            <th style={s.th}>{t("descriptores.columnas.valor")}</th>
            <th style={s.th}>{t("descriptores.columnas.metodo")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={s.td}>{r.param}</td>
              <td style={s.tdVal}>{r.value}</td>
              <td style={s.tdMethod}>{r.method}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={s.sectionTitle}>{t("impresion.graficos")}</div>
      <div style={s.figura}>
        <div style={s.figuraTitulo}>{t("analisis.graficos.curvaLuz")}</div>
        <div style={s.figuraSub}>
          {t("analisis.graficos.curvaLuzSub", { n: puntos.length, x: configuracion.mapeo.time, y: configuracion.mapeo.flux })}
        </div>
        <LightCurveChart
          points={puntos}
          xLabel={configuracion.mapeo.time}
          yLabel={yLabel}
          invertir={invertir}
          ancho={ANCHO_GRAFICO}
          alto={ALTO_GRAFICO}
          impresion
        />
      </div>
      <div style={s.figura}>
        <div style={s.figuraTitulo}>{t("analisis.graficos.curvaFase")}</div>
        <div style={s.figuraSub}>
          {resultado.derivados.periodo_principal_dias
            ? t("analisis.graficos.curvaFaseSub", { periodo: resultado.derivados.periodo_principal_dias.toFixed(5) })
            : t("analisis.graficos.sinPeriodo")}
        </div>
        <PhasedCurveChart
          points={fase}
          yLabel={yLabel}
          invertir={invertir}
          ancho={ANCHO_GRAFICO}
          alto={ALTO_GRAFICO}
          impresion
        />
      </div>

      <div style={s.sectionTitle}>{t("impresion.reporteNarrativo")}</div>
      <div style={s.report}>
        {reporte ? (
          <TextoReporte
            texto={reporte.texto}
            estilos={{
              titulo: { fontSize: "11.5pt", fontWeight: 700, margin: "10pt 0 4pt" },
              parrafo: { margin: "0 0 8pt", textAlign: "justify" },
            }}
          />
        ) : (
          <p>{t("impresion.sinReporte")}</p>
        )}
        {reporte && reporte.fuentes.length > 0 && (
          <p style={{ fontSize: "9pt", color: "#555", marginTop: "8pt" }}>
            {t("impresion.fuentes", { fuentes: reporte.fuentes.join(", ") })}
          </p>
        )}
      </div>

      <div style={s.disclaimer}>
        <Trans i18nKey="impresion.aviso" components={{ strong: <strong /> }} />
      </div>

      <div style={s.footer}>
        {t("impresion.pie")}
      </div>
    </div>
  );
}