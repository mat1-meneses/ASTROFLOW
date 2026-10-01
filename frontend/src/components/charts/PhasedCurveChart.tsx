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
import type { PhasedPoint } from "../../types";
import { dominioY } from "../../utils/fase";

interface Props {
  points: PhasedPoint[];
  yLabel: string;
  invertir: boolean;
}

const C = {
  scatter: "#818cf8",
  grid: "#1d3050",
  axis: "#5e738a",
  panel: "#0d1827",
  ref: "#1d3050",
};

export default function PhasedCurveChart({ points, yLabel, invertir }: Props) {
  if (points.length === 0) return <EmptyChart />;

  const [yMin, yMax] = dominioY(points.map((p) => p.flux));

  return (
    <ResponsiveContainer width="100%" height={270}>
      <ScatterChart margin={{ top: 4, right: 8, bottom: 24, left: 8 }}>
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
          label={{ value: "Fase (φ)", position: "insideBottom", offset: -14, fill: C.axis, fontSize: 10, fontFamily: "JetBrains Mono" }}
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
        <ZAxis range={[14, 14]} />
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
            name === "flux" ? yLabel : "Fase",
          ]}
        />
        <ReferenceLine x={1} stroke={C.ref} strokeDasharray="4 4" strokeOpacity={0.8} />
        <Scatter data={points} fill={C.scatter} opacity={0.75} isAnimationActive={points.length < 3000} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="h-64 flex items-center justify-center text-astro-muted text-sm">
      Sin período válido para plegar la curva
    </div>
  );
}
