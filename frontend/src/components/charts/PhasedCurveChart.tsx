import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { PhasedPoint } from "../../types";
import { dominioY } from "../../utils/fase";

interface Props {
  points: PhasedPoint[];
  yLabel: string;
  invertir: boolean;
  /** Alto del gráfico: número en px o "100%" (vista ampliada). */
  alto?: number | `${number}%`;
  /** Ancho fijo en px. Si no se entrega, el gráfico se adapta al contenedor. */
  ancho?: number;
  /** Modo PDF: colores para papel blanco, sin animación ni tooltip. */
  impresion?: boolean;
}

const PANTALLA = {
  scatter: "var(--astro-indigo)",
  grid: "var(--astro-border)",
  axis: "var(--astro-muted)",
  panel: "var(--astro-surface)",
  ref: "var(--astro-border)",
};

const IMPRESION = {
  scatter: "#4f46e5",
  grid: "#d4d4d4",
  axis: "#333333",
  panel: "#ffffff",
  ref: "#999999",
};

export default function PhasedCurveChart({ points, yLabel, invertir, alto = 270, ancho, impresion = false }: Props) {
  const { t } = useTranslation();
  if (points.length === 0) return <EmptyChart texto={t("analisis.graficos.sinPeriodoPlegar")} />;

  const C = impresion ? IMPRESION : PANTALLA;
  const ejeFase = t("analisis.graficos.ejeFase");
  const [yMin, yMax] = dominioY(points.map((p) => p.flux));

  const grafico = (
    <ScatterChart
      width={ancho}
      height={ancho ? Number(alto) : undefined}
      margin={{ top: 4, right: 8, bottom: 24, left: 8 }}
    >
      <CartesianGrid strokeDasharray="2 5" stroke={C.grid} strokeOpacity={0.7} />
      <XAxis
        type="number"
        dataKey="phase"
        domain={[0, 2]}
        ticks={[0, 0.5, 1, 1.5, 2]}
        tick={{ fill: C.axis, fontSize: 9, fontFamily: "JetBrains Mono" }}
        tickLine={false}
        axisLine={{ stroke: C.grid }}
        tickFormatter={(v) => Number(v).toFixed(1)}
        label={{ value: ejeFase, position: "insideBottom", offset: -14, fill: C.axis, fontSize: 10, fontFamily: "JetBrains Mono" }}
      />
      <YAxis
        type="number"
        dataKey="flux"
        domain={[yMin, yMax]}
        reversed={invertir}
        tick={{ fill: C.axis, fontSize: 9, fontFamily: "JetBrains Mono" }}
        tickLine={false}
        axisLine={{ stroke: C.grid }}
        width={58}
        tickFormatter={(v) => Number(v).toFixed(2)}
        label={{ value: yLabel, angle: -90, position: "insideLeft", fill: C.axis, fontSize: 10, fontFamily: "JetBrains Mono", offset: 14 }}
      />
      <ZAxis range={impresion ? [8, 8] : [14, 14]} />
      {!impresion && (
        <Tooltip
          contentStyle={{
            backgroundColor: C.panel,
            border: `1px solid ${C.grid}`,
            borderRadius: "6px",
            fontSize: "11px",
            fontFamily: "JetBrains Mono",
            padding: "8px 12px",
          }}
          labelStyle={{ color: C.axis }}
          itemStyle={{ color: C.scatter }}
          cursor={{ strokeDasharray: "3 3", stroke: C.grid }}
          formatter={(value, name) => [
            typeof value === "number" ? value.toFixed(4) : String(value),
            name === "flux" ? yLabel : ejeFase,
          ]}
        />
      )}
      <ReferenceLine x={1} stroke={C.ref} strokeDasharray="4 4" strokeOpacity={0.8} />
      <Scatter
        data={points}
        fill={C.scatter}
        opacity={0.75}
        isAnimationActive={!impresion && points.length < 3000}
      />
    </ScatterChart>
  );

  if (ancho) return grafico;
  return (
    <ResponsiveContainer width="100%" height={alto}>
      {grafico}
    </ResponsiveContainer>
  );
}

function EmptyChart({ texto }: { texto: string }) {
  return <div className="h-64 flex items-center justify-center text-astro-muted text-sm">{texto}</div>;
}
