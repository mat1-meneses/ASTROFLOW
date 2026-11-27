// Tarjeta de clasificación automática (Random Forest · OGLE-III)
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ClasificacionPanel from "../components/ClasificacionPanel";
import type { Clasificacion } from "../types";

const base: Clasificacion = {
  clase: "ECL",
  segunda_clase: "LPV",
  probabilidades: { CEP: 0.02, DSCT: 0.12, ECL: 0.47, LPV: 0.38, RRLYR: 0.01 },
  confianza: "baja",
  avisos: ["magnitud_fuera_de_rango", "puntaje_bajo"],
  descriptores: {},
  dominio_entrenamiento: { Mean: [12.97, 21.45], Period: [0.1, 11563] },
  modelo: {
    algoritmo: "Random Forest (224 árboles)",
    datos_entrenamiento: "OGLE-III (banda I)",
    clases: ["CEP", "DSCT", "ECL", "LPV", "RRLYR"],
    f1_macro_prueba: 0.7081,
    n_entrenamiento: 2896,
    n_prueba: 28450,
  },
};

describe("ClasificacionPanel", () => {
  it("muestra la clase, los 5 puntajes ordenados y los avisos de poca confianza", () => {
    render(<ClasificacionPanel clasificacion={base} />);

    expect(screen.getByText("Tipo de estrella más probable")).toBeInTheDocument();
    expect(screen.getAllByText("Binaria eclipsante")).toHaveLength(2); // título y barra
    expect(screen.getByText("Confianza baja")).toBeInTheDocument();
    const filas = screen.getAllByRole("listitem");
    expect(filas).toHaveLength(5);
    expect(filas[0]).toHaveTextContent("0.47");
    expect(filas[1]).toHaveTextContent("Variable de período largo");
    expect(screen.getByText(/Clasificación poco confiable/)).toBeInTheDocument();
    expect(screen.getByText(/magnitud media está fuera del rango/)).toBeInTheDocument();
    expect(screen.getByText(/224 árboles.*0\.71/)).toBeInTheDocument();
  });

  it("con confianza alta no muestra avisos", () => {
    render(<ClasificacionPanel clasificacion={{ ...base, confianza: "alta", avisos: [] }} />);
    expect(screen.getByText("Confianza alta")).toBeInTheDocument();
    expect(screen.queryByText(/poco confiable/)).not.toBeInTheDocument();
  });

  it("en análisis antiguos sin clasificación muestra que no está disponible", () => {
    render(<ClasificacionPanel clasificacion={undefined} />);
    expect(screen.getByText(/Clasificación no disponible/)).toBeInTheDocument();
  });
});
