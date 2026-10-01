// Plegado en fase SOLO para visualización.
// El período lo calcula el microservicio (Lomb-Scargle en feets); aquí solo
// se reordenan los puntos con ese período para dibujar la curva en fase.

import type { LightCurvePoint, PhasedPoint, Serie, TipoBrillo } from "../types";

export function puntosDesdeSerie(serie: Serie): LightCurvePoint[] {
  return serie.time.map((t, i) => ({
    time: t,
    flux: serie.magnitude[i],
    error: serie.error[i],
  }));
}

/**
 * Pliega la serie con el período dado. La fase 0 se fija en el punto más
 * brillante (menor magnitud, o mayor flujo). Se devuelven dos ciclos
 * (fase 0–2), como es habitual en astronomía, para ver la forma completa.
 */
export function plegarEnFase(
  puntos: LightCurvePoint[],
  periodo: number | null,
  tipo: TipoBrillo
): PhasedPoint[] {
  if (!periodo || periodo <= 0 || puntos.length === 0) return [];

  let referencia = puntos[0];
  for (const p of puntos) {
    const masBrillante = tipo === "magnitud" ? p.flux < referencia.flux : p.flux > referencia.flux;
    if (masBrillante) referencia = p;
  }
  const t0 = referencia.time;

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
