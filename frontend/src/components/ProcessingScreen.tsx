// Pantalla de espera mientras el microservicio calcula los descriptores.
// A diferencia de la versión de Figma, no muestra valores inventados:
// los pasos describen lo que realmente hace el backend y los números
// aparecen recién en la vista de resultados.
import AppHeader from "./AppHeader";

interface Props {
  starName: string;
  nPuntos: number;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}

const PASOS = [
  {
    label: "Extracción de columnas y exclusión de valores faltantes",
    detalle: (n: number) => `${n} observaciones válidas enviadas al servidor`,
    hecho: true,
  },
  {
    label: "Limpieza de ruido (feets)",
    detalle: () => "Puntos con error > 3 × error medio o a más de 5σ de la media",
    hecho: false,
  },
  {
    label: "Periodograma Lomb-Scargle y descriptores (feets)",
    detalle: () => "Período, probabilidad de falsa alarma, amplitud, armónicos de Fourier",
    hecho: false,
  },
];

export default function ProcessingScreen({ starName, nPuntos, error, onRetry, onBack }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-astro-border bg-astro-surface mb-4">
              {error ? (
                <svg className="w-5 h-5 text-astro-red" viewBox="0 0 20 20" fill="none">
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-astro-accent animate-spin" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2" />
                  <path d="M10 2a8 8 0 018 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <h2 className="text-lg font-semibold text-astro-text">
              {error ? "No se pudo completar el análisis" : "Procesando curva de luz"}
            </h2>
            <p className="text-xs text-astro-muted font-mono mt-1 truncate max-w-xs mx-auto">{starName}</p>
          </div>

          {error ? (
            <div className="space-y-4">
              <div className="text-sm text-astro-red bg-astro-red/5 border border-astro-red/20 rounded px-4 py-3">
                {error}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onRetry}
                  className="bg-astro-accent text-astro-bg font-semibold text-sm px-4 py-2 rounded hover:brightness-110 transition-all"
                >
                  Reintentar
                </button>
                <button
                  onClick={onBack}
                  className="text-sm text-astro-muted border border-astro-border rounded px-4 py-2 hover:text-astro-text transition-colors"
                >
                  Volver al mapeo de columnas
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {PASOS.map((paso) => (
                <div
                  key={paso.label}
                  className={`flex items-start gap-3 rounded-lg p-3 bg-astro-surface ${paso.hecho ? "" : "opacity-70"}`}
                >
                  <div
                    className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${
                      paso.hecho ? "bg-astro-accent" : "border border-astro-accent/60 animate-pulse"
                    }`}
                  >
                    {paso.hecho && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-astro-bg">
                        <path d="M1.5 4l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-astro-text">{paso.label}</p>
                    <p className="text-xs text-astro-muted font-mono mt-0.5">{paso.detalle(nPuntos)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
