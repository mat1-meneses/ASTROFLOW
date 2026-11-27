// Plegado en fase SOLO para visualización.
// El período lo calcula el microservicio (Lomb-Scargle + selección multiarmónica); aquí solo
// se reordenan los puntos con ese período para dibujar la curva en fase.

import type { LightCurvePoint, PhasedPoint, Serie, TipoBrillo } from "../types";

export function puntosDesdeSerie(serie: Serie): LightCurvePoint[] {
  return serie.time.map((t, i) => ({
    time: t,
    flux: serie.magnitude[i],
    error: serie.error[i],
  }));
}

export type FaseCero = "maximo" | "minimo";

/** Instantes del valor mínimo y máximo de la curva ajustada (Fourier), si el microservicio los entrega. */
export interface EpocasAjuste {
  tValorMinimo?: number | null;
  tValorMaximo?: number | null;
}

/**
 * Pliega la serie con el período dado y devuelve dos ciclos (fase 0–2), como es
 * habitual en astronomía, para ver la forma completa.
 *
 * La fase 0 se fija en el máximo de brillo (por defecto) o en el mínimo de brillo
 * (útil en binarias eclipsantes, como hace OGLE). Se usa el instante del ajuste de
 * Fourier, para que un punto atípico no desplace el gráfico; los análisis guardados
 * antes de este cambio no lo tienen y usan el punto observado más brillante/débil.
 */
export function plegarEnFase(
  puntos: LightCurvePoint[],
  periodo: number | null,
  tipo: TipoBrillo,
  faseCero: FaseCero = "maximo",
  epocas: EpocasAjuste = {}
): PhasedPoint[] {
  if (!periodo || periodo <= 0 || puntos.length === 0) return [];

  // En magnitudes, más brillante = valor menor; en flujo, valor mayor.
  const buscaValorMenor = (tipo === "magnitud") === (faseCero === "maximo");
  const delAjuste = buscaValorMenor ? epocas.tValorMinimo : epocas.tValorMaximo;

  let t0: number;
  if (typeof delAjuste === "number" && Number.isFinite(delAjuste)) {
    t0 = delAjuste;
  } else {
    let referencia = puntos[0];
    for (const p of puntos) {
      if (buscaValorMenor ? p.flux < referencia.flux : p.flux > referencia.flux) referencia = p;
    }
    t0 = referencia.time;
  }

  const fase: PhasedPoint[] = [];
  for (const p of puntos) {
    const phi = (((p.time - t0) / periodo) % 1 + 1) % 1;
    fase.push({ phase: phi, flux: p.flux }, { phase: phi + 1, flux: p.flux });
  }
  return fase;
}

/** Dominio del eje Y con un margen proporcional (funciona con magnitudes negativas). */
export function dominioY(valores: number[]): [number, number] {
  // Bucle en vez de Math.min(...valores): con decenas de miles de puntos el spread desborda la pila.
  let min = Infinity;
  let max = -Infinity;
  for (const v of valores) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const margen = (max - min) * 0.06 || 0.05;
  return [min - margen, max + margen];
}
