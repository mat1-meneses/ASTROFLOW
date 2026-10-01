import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";
import type { LightCurvePoint } from "../../types";
import { dominioY } from "../../utils/fase";

interface Props {
  points: LightCurvePoint[];
  xLabel: string;
  yLabel: string;
  /** true para magnitudes: el eje se invierte para que "más brillante" quede arriba. */
  invertir: boolean;
}

const C = {
  line: "#38bdf8",
  grid: "#1d3050",
  axis: "#5e738a",
  bg: "#070c17",
  panel: "#0d1827",
};

export default function LightCurveChart({ points, xLabel, yLabel, invertir }: Props) {
  if (points.length === 0) return <EmptyChart />;

  // Orden temporal + eje X numérico: los huecos entre observaciones se ven con su escala real.
  const data = [...points]
    .sort((a, b) => a.time - b.time)
    .map((p) => ({ t: p.time, f: p.flux }));
  const [yMin, yMax] = dominioY(data.map((d) => d.f));

  return (
    <ResponsiveContainer width="100%" height={270}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 24, left: 8 }}>
        <CartesianGrid strokeDasharray="2 5" stroke={C.grid} strokeOpacity={0.7} />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          tick={{ fill: C.axis, fontSize: 9, fontFamily: "JetBrains Mono" }}
          tickLine={false}
          axisLine={{ stroke: C.grid }}
          tickFormatter={(v) => Number(v).toFixed(0)}
          label={{ value: xLabel, position: "insideBottom", offset: -14, fill: C.axis, fontSize: 10, fontFamily: "JetBrains Mono" }}
        />
        <YAxis
          domain={[yMin, yMax]}
          reversed={invertir}
          tick={{ fill: C.axis, fontSize: 9, fontFamily: "JetBrains Mono" }}
          tickLine={false}
          axisLine={{ stroke: C.grid }}
          width={58}
          tickFormatter={(v) => Number(v).toFixed(2)}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: C.axis, fontSize: 10, fontFamily: "JetBrains Mono", offset: 14 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: C.panel,
            border: `1px solid ${C.grid}`,
            borderRadius: "6px",
            fontSize: "11px",
            fontFamily: "JetBrains Mono",
            padding: "8px 12px",
          }}
          labelStyle={{ color: C.axis, marginBottom: "4px" }}
          itemStyle={{ color: C.line }}
          formatter={(value) => (typeof value === "number" ? [value.toFixed(4), yLabel] : [String(value), ""])}
          labelFormatter={(label) => `${xLabel} ${Number(label).toFixed(4)}`}
          cursor={{ stroke: C.grid, strokeWidth: 1, strokeDasharray: "3 3" }}
        />
        <Line
          type="monotone"
          dataKey="f"
          stroke="transparent"
          dot={{ r: 2, fill: C.line, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: C.line, strokeWidth: 0 }}
          isAnimationActive={data.length < 3000}
          animationDuration={600}
        />
        <Brush
          dataKey="t"
          height={18}
          stroke={C.grid}
          fill={C.bg}
          travellerWidth={5}
          tickFormatter={(v) => String(Math.round(Number(v)))}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center text-astro-muted text-sm">
      Sin datos para mostrar
    </div>
  );
}
