import type { Calibracion, ResultadoDescriptores, TipoBrillo } from "../types";
import { filasDescriptores } from "../utils/filasDescriptores";

interface Props {
  resultado: ResultadoDescriptores;
  tipoBrillo: TipoBrillo;
  calibracion: Calibracion;
}

export default function DescriptorsPanel({ resultado, tipoBrillo, calibracion }: Props) {
  const filas = filasDescriptores(resultado, tipoBrillo, calibracion);

  return (
    <div className="overflow-x-auto border border-astro-border rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-astro-surface-2">
          <tr>
            {["Parámetro", "Valor", "Unidad", "Método", "Descripción"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium text-astro-muted uppercase tracking-wider border-b border-astro-border whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={f.parametro}
              className="border-b border-astro-border/40 hover:bg-astro-surface-2/60 transition-colors last:border-b-0"
            >
              <td className="px-4 py-3 font-medium text-astro-text whitespace-nowrap">{f.parametro}</td>
              <td className="px-4 py-3 font-mono font-semibold text-astro-accent whitespace-nowrap">{f.valor}</td>
              <td className="px-4 py-3 font-mono text-xs text-astro-muted whitespace-nowrap">{f.unidad}</td>
              <td className="px-4 py-3">
                <span className="bg-astro-surface-2 border border-astro-border rounded px-2 py-0.5 text-xs font-mono text-astro-indigo whitespace-nowrap">
                  {f.metodo}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-astro-muted">{f.descripcion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
