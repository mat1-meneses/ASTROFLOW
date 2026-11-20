import { Trans, useTranslation } from "react-i18next";
import type { ConfiguracionAnalisis, Reporte, ResultadoDescriptores } from "../types";
import { filasDescriptores } from "../utils/filasDescriptores";
import TextoReporte from "./TextoReporte";

interface Props {
  starName: string;
  resultado: ResultadoDescriptores;
  configuracion: ConfiguracionAnalisis;
  reporte: Reporte | null;
  analysisDate: string;
}

/**
 * Vista de impresión (Exportar PDF). Usa solo estilos en línea para no depender de Tailwind.
 * El reporte se renderiza con TextoReporte (sin innerHTML).
 */
export default function PrintView({ starName, resultado, configuracion, reporte, analysisDate }: Props) {
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
    disclaimer: { marginTop: "24pt", padding: "10pt", border: "1px solid #ccc", fontSize: "9pt", color: "#555", backgroundColor: "#f9f9f9" } as React.CSSProperties,
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

      <div style={s.sectionTitle}>{t("impresion.reporteNarrativo")}</div>
      <div style={s.report}>
        {reporte ? (
          <TextoReporte
            texto={reporte.texto}
            estilos={{
              titulo: { fontSize: "11.5pt", fontWeight: 700, margin: "10pt 0 4pt" },
              parrafo: { margin: "0 0 8pt" },
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