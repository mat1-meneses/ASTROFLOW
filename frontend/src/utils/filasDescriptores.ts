// Filas de la tabla de descriptores, compartidas por DescriptorsPanel y PrintView.
// Solo se muestran valores que entrega el microservicio; nada se inventa aquí.

import type { Calibracion, ResultadoDescriptores, TipoBrillo } from "../types";

export interface FilaDescriptor {
  parametro: string;
  valor: string;
  unidad: string;
  metodo: string;
  descripcion: string;
}

function primero(v: number | number[] | null | undefined): number | null {
  if (Array.isArray(v)) return v.length > 0 ? v[0] : null;
  return v ?? null;
}

function fmt(v: number | null | undefined, decimales: number): string {
  return v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(decimales);
}

export function filasDescriptores(
  r: ResultadoDescriptores,
  tipo: TipoBrillo,
  calibracion: Calibracion
): FilaDescriptor[] {
  const d = r.descriptores;
  const der = r.derivados;
  const unidad = tipo === "magnitud" ? "mag" : "flujo";
  const fap = der.prob_falsa_alarma;

  const filas: FilaDescriptor[] = [
    {
      parametro: "Período",
      valor: fmt(der.periodo_principal_dias, 5),
      unidad: "días",
      metodo: "Lomb-Scargle (feets)",
      descripcion: "Período dominante del periodograma",
    },
    {
      parametro: "Probabilidad de falsa alarma",
      valor: fap === null ? "—" : fap.toExponential(2),
      unidad: "—",
      metodo: "Lomb-Scargle (feets)",
      descripcion: "Probabilidad de que el pico del periodograma sea ruido; cercana a 0 indica un período significativo",
    },
    {
      parametro: "Semiamplitud",
      valor: fmt(der.amplitud_fats, 4),
      unidad,
      metodo: "Fórmula FATS",
      descripcion: "Mitad de la diferencia entre la mediana del 5 % más débil y la del 5 % más brillante",
    },
    {
      parametro: tipo === "magnitud" ? "Magnitud media" : "Flujo medio",
      valor: fmt(primero(d.Mean), 4),
      unidad,
      metodo: "feets",
      descripcion:
        calibracion === "estandar"
          ? "Media de la serie"
          : "Media de la serie. Sin calibración estándar declarada, no equivale a una magnitud aparente",
    },
    {
      parametro: "Desviación estándar (σ)",
      valor: fmt(primero(d.Std), 4),
      unidad,
      metodo: "feets",
      descripcion: "Dispersión de la serie respecto a su media",
    },
    {
      parametro: "Asimetría",
      valor: fmt(primero(d.Skew), 3),
      unidad: "—",
      metodo: "feets",
      descripcion: "Asimetría de la distribución de valores",
    },
    {
      parametro: "Curtosis",
      valor: fmt(primero(d.SmallKurtosis), 3),
      unidad: "—",
      metodo: "feets",
      descripcion: "Curtosis para muestras pequeñas",
    },
    {
      parametro: "R21",
      valor: fmt(der.R21, 3),
      unidad: "—",
      metodo: "Armónicos de Fourier (feets)",
      descripcion: "Amplitud del 2.º armónico respecto al fundamental",
    },
    {
      parametro: "R31",
      valor: fmt(der.R31, 3),
      unidad: "—",
      metodo: "Armónicos de Fourier (feets)",
      descripcion: "Amplitud del 3.er armónico respecto al fundamental",
    },
  ];

  if (d.StetsonK !== undefined) {
    filas.push({
      parametro: "Índice K de Stetson",
      valor: fmt(primero(d.StetsonK), 3),
      unidad: "—",
      metodo: "feets",
      descripcion: "Robustez de la variabilidad considerando los errores fotométricos",
    });
  }

  filas.push(
    {
      parametro: "Observaciones usadas",
      valor: String(r.n_puntos_usados),
      unidad: "puntos",
      metodo: "Conteo",
      descripcion: `De ${r.n_puntos_recibidos} recibidas, tras descartar valores faltantes y ruido`,
    },
    {
      parametro: "Puntos atípicos restantes",
      valor: String(der.n_atipicos_4sigma),
      unidad: "puntos",
      metodo: "Mediana y MAD",
      descripcion: "Puntos a más de 4 sigmas robustas que permanecen en los datos analizados",
    }
  );

  return filas;
}
