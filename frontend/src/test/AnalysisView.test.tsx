// PU-15 — Solicitud automática del reporte (CU-09, RF-20)
// Al terminar el cálculo de descriptores (CU-06), el sistema solicita automáticamente el reporte.
import { StrictMode, useCallback, useState } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Analisis, Reporte } from "../types";
import AnalysisView from "../components/AnalysisView";
import { generarReporte } from "../api/analisis";

vi.mock("../api/analisis", () => ({ generarReporte: vi.fn() }));
vi.mock("../context/SesionContext", () => ({
  useSesion: () => ({ usuario: null, cargando: false, iniciar: vi.fn(), cerrar: vi.fn() }),
}));
// Los gráficos (Recharts) necesitan medir el DOM, algo que el navegador simulado no hace.
vi.mock("../components/charts/LightCurveChart", () => ({ default: () => null }));
vi.mock("../components/charts/PhasedCurveChart", () => ({ default: () => null }));

const mockGenerarReporte = vi.mocked(generarReporte);

const analisisSinReporte: Analisis = {
  nombre: "OGLE-LMC-RRLYR-00050",
  configuracion: {
    mapeo: { time: "HJD", flux: "I", error: "err" },
    tipoBrillo: "magnitud",
    calibracion: "estandar",
    banda: "I",
  },
  serie: { time: [1, 2, 3], magnitude: [19.0, 19.2, 19.1], error: [0.02, 0.02, 0.02] },
  resultado: {
    n_puntos_recibidos: 401,
    n_descartados_faltantes: 0,
    n_puntos_usados: 401,
    descriptores: { Mean: 19.0118, Std: 0.1765, Skew: -0.372, SmallKurtosis: -0.876, StetsonK: 0.74 },
    derivados: {
      periodo_principal_dias: 0.56479,
      prob_falsa_alarma: 1.18e-58,
      amplitud_fats: 0.3115,
      R21: 0.438,
      R31: 0.329,
      n_atipicos_4sigma: 0,
    },
  },
  reporte: null,
};

const reporte: Reporte = {
  texto: "## Resumen\nLa curva corresponde probablemente a una RR Lyrae.",
  fuentes: [],
  advertencias: [],
  estado: "borrador",
  idioma: "es",
};

/** Reproduce lo que hace FlujoAnalisis: guarda el reporte recibido en el análisis. */
function Pantalla({ inicial }: { inicial: Analisis }) {
  const [analisis, setAnalisis] = useState(inicial);
  const alCambiarReporte = useCallback((r: Reporte) => setAnalisis((a) => ({ ...a, reporte: r })), []);
  return (
    <AnalysisView
      analisis={analisis}
      onReporteChange={alCambiarReporte}
      onSave={vi.fn()}
      estadoGuardado="sin-guardar"
      onBack={vi.fn()}
      backLabel="Nueva curva"
    />
  );
}

function renderizar(inicial: Analisis) {
  // StrictMode monta los efectos dos veces en desarrollo: sirve para comprobar que el reporte se pide una sola vez.
  render(
    <StrictMode>
      <MemoryRouter>
        <Pantalla inicial={inicial} />
      </MemoryRouter>
    </StrictMode>
  );
}

afterEach(() => mockGenerarReporte.mockReset());

describe("AnalysisView — solicitud automática del reporte", () => {
  it("PU-15: con descriptores calculados pide el reporte una sola vez y bloquea Exportar/Guardar mientras se genera", async () => {
    let entregar!: (r: Reporte) => void;
    mockGenerarReporte.mockReturnValue(new Promise<Reporte>((resolver) => (entregar = resolver)));

    renderizar(analisisSinReporte);

    // Se solicita automáticamente, sin ningún clic, y una sola vez
    expect(mockGenerarReporte).toHaveBeenCalledTimes(1);
    expect(mockGenerarReporte).toHaveBeenCalledWith({
      resultado: analisisSinReporte.resultado,
      banda: "I",
      calibracion: "estandar",
      idioma: "es",
    });

    // Mientras se genera: aviso visible y botones deshabilitados
    expect(screen.getByText(/Generando el reporte/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar en historial" })).toBeDisabled();

    // Al llegar el reporte: se muestra y los botones se habilitan
    entregar(reporte);
    expect(await screen.findByText(/probablemente a una RR Lyrae/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Guardar en historial" })).toBeEnabled();
    expect(mockGenerarReporte).toHaveBeenCalledTimes(1);
  });

  it("PU-15b: un análisis guardado que ya tiene reporte no lo vuelve a solicitar", () => {
    renderizar({ ...analisisSinReporte, id: 12, reporte });

    expect(mockGenerarReporte).not.toHaveBeenCalled();
    expect(screen.getByText(/probablemente a una RR Lyrae/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled();
  });
});
