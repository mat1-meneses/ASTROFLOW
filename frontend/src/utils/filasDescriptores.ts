// Filas de la tabla de descriptores, compartidas por DescriptorsPanel y PrintView.
// Solo se muestran valores que entrega el microservicio; nada se inventa aquí.
// Los textos se traducen con la función t de i18next, que recibe como parámetro.

import type { TFunction } from "i18next";
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
  calibracion: Calibracion,
  t: TFunction
): FilaDescriptor[] {
  const d = r.descriptores;
  const der = r.derivados;
  const unidad = tipo === "magnitud" ? "mag" : t("descriptores.unidades.flujo");
  const fap = der.prob_falsa_alarma;

  // Atajo: t("descriptores.filas.<clave>.<campo>")
  const f = (clave: string, campo: string, opciones?: Record<string, unknown>) =>
    t(`descriptores.filas.${clave}.${campo}`, opciones);

  const metodoLomb = t("descriptores.metodos.lomb");
  const metodoFourier = t("descriptores.metodos.fourier");

  const filas: FilaDescriptor[] = [
    {
      parametro: f("periodo", "parametro"),
      valor: fmt(der.periodo_principal_dias, 5),
      unidad: t("descriptores.unidades.dias"),
      metodo: metodoLomb,
      descripcion: f("periodo", "descripcion"),
    },
    {
      parametro: f("fap", "parametro"),
      valor: fap === null ? "—" : fap.toExponential(2),
      unidad: "—",
      metodo: metodoLomb,
      descripcion: f("fap", "descripcion"),
    },
    {
      parametro: f("semiamplitud", "parametro"),
      valor: fmt(der.amplitud_fats, 4),
      unidad,
      metodo: t("descriptores.metodos.fats"),
      descripcion: f("semiamplitud", "descripcion"),
    },
    {
      parametro: tipo === "magnitud" ? f("media", "parametroMagnitud") : f("media", "parametroFlujo"),
      valor: fmt(primero(d.Mean), 4),
      unidad,
      metodo: "feets",
      descripcion:
        calibracion === "estandar"
          ? f("media", "descripcion")
          : f("media", "descripcionSinCalibracion"),
    },
    {
      parametro: f("std", "parametro"),
      valor: fmt(primero(d.Std), 4),
      unidad,
      metodo: "feets",
      descripcion: f("std", "descripcion"),
    },
    {
      parametro: f("asimetria", "parametro"),
      valor: fmt(primero(d.Skew), 3),
      unidad: "—",
      metodo: "feets",
      descripcion: f("asimetria", "descripcion"),
    },
    {
      parametro: f("curtosis", "parametro"),
      valor: fmt(primero(d.SmallKurtosis), 3),
      unidad: "—",
      metodo: "feets",
      descripcion: f("curtosis", "descripcion"),
    },
    {
      parametro: "R21",
      valor: fmt(der.R21, 3),
      unidad: "—",
      metodo: metodoFourier,
      descripcion: f("r21", "descripcion"),
    },
    {
      parametro: "R31",
      valor: fmt(der.R31, 3),
      unidad: "—",
      metodo: metodoFourier,
      descripcion: f("r31", "descripcion"),
    },
  ];

  if (d.StetsonK !== undefined) {
    filas.push({
      parametro: f("stetsonK", "parametro"),
      valor: fmt(primero(d.StetsonK), 3),
      unidad: "—",
      metodo: "feets",
      descripcion: f("stetsonK", "descripcion"),
    });
  }

  filas.push(
    {
      parametro: f("obsUsadas", "parametro"),
      valor: String(r.n_puntos_usados),
      unidad: t("descriptores.unidades.puntos"),
      metodo: t("descriptores.metodos.conteo"),
      descripcion: f("obsUsadas", "descripcion", { recibidas: r.n_puntos_recibidos }),
    },
    {
      parametro: f("atipicos", "parametro"),
      valor: String(der.n_atipicos_4sigma),
      unidad: t("descriptores.unidades.puntos"),
      metodo: t("descriptores.metodos.mad"),
      descripcion: f("atipicos", "descripcion"),
    }
  );

  return filas;
}