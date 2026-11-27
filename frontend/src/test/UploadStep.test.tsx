// PU-05 y PU-14 — Pantalla de carga: formatos no soportados (CU-02, RF-01)
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import UploadStep from "../components/UploadStep";

// La cabecera consulta la sesión; en la prueba se simula un invitado sin llamar al backend.
vi.mock("../context/SesionContext", () => ({
  useSesion: () => ({ usuario: null, cargando: false, iniciar: vi.fn(), cerrar: vi.fn() }),
}));

function renderizar() {
  const onFileLoaded = vi.fn();
  render(
    <MemoryRouter>
      <UploadStep onFileLoaded={onFileLoaded} onUseExample={vi.fn()} />
    </MemoryRouter>
  );
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  return { onFileLoaded, input };
}

// applyAccept: false simula a un usuario que elige "Todos los archivos" en el diálogo.
const usuario = () => userEvent.setup({ applyAccept: false });

describe("UploadStep", () => {
  it("PU-05: rechaza un archivo .docx con un mensaje de formato no soportado", async () => {
    const { onFileLoaded, input } = renderizar();
    await usuario().upload(input, new File(["texto"], "informe.docx"));

    expect(await screen.findByText(/Formato no soportado/)).toBeInTheDocument();
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("PU-14: al subir un .png muestra el error y no avanza al mapeo", async () => {
    const { onFileLoaded, input } = renderizar();
    await usuario().upload(input, new File([new Uint8Array([137, 80, 78, 71])], "grafico.png", { type: "image/png" }));

    expect(await screen.findByText(/Formato no soportado/)).toBeInTheDocument();
    expect(onFileLoaded).not.toHaveBeenCalled();
  });

  it("PU-14b: un .csv válido sí avanza (se entrega su contenido al flujo)", async () => {
    const { onFileLoaded, input } = renderizar();
    await usuario().upload(input, new File(["time,mag,err\n1,15,0.02"], "curva.csv", { type: "text/csv" }));

    await waitFor(() => expect(onFileLoaded).toHaveBeenCalledWith("time,mag,err\n1,15,0.02", "curva.csv"));
    expect(screen.queryByText(/Formato no soportado/)).not.toBeInTheDocument();
  });
});
