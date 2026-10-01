import type { ResumenAnalisis } from "../types";
import { StarIcon } from "./AppHeader";
import UserMenu from "./UserMenu";

interface Props {
  history: ResumenAnalisis[];
  cargando: boolean;
  error: string | null;
  onNewCurve: () => void;
  onLoadCurve: (c: ResumenAnalisis) => void;
}

export default function Dashboard({ history, cargando, error, onNewCurve, onLoadCurve }: Props) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-astro-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StarIcon />
          <span className="text-xl font-semibold tracking-wider text-astro-text">
            ASTRO<span className="text-astro-accent">FLOW</span>
          </span>
          <span className="text-xs text-astro-muted font-mono bg-astro-surface-2 px-2 py-0.5 rounded border border-astro-border ml-1">
            v0.1-beta
          </span>
        </div>
        <div className="flex items-center gap-5">
        <UserMenu />
        <button
          onClick={onNewCurve}
          className="flex items-center gap-2 bg-astro-accent text-astro-bg font-semibold text-sm px-4 py-2.5 rounded hover:brightness-110 transition-all"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 1v12M1 7h12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Cargar nueva curva de luz
        </button>
        </div>
      </header>

      <main className="flex-1 px-8 py-10 max-w-5xl mx-auto w-full">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-astro-text mb-1">
              Mis análisis
            </h1>
            <p className="text-sm text-astro-muted">
              Análisis guardados en tu cuenta. Abre uno para ver sus gráficos,
              descriptores y reporte.
            </p>
          </div>
          {history.length > 0 && (
            <span className="font-mono text-xs text-astro-muted">
              {history.length} curva{history.length !== 1 ? "s" : ""} guardada
              {history.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {cargando ? (
          <p className="text-sm text-astro-muted">Cargando análisis…</p>
        ) : error ? (
          <p className="text-sm text-astro-red">{error}</p>
        ) : history.length === 0 ? (
          <EmptyState onNewCurve={onNewCurve} />
        ) : (
          <div className="space-y-3">
            {history.map((curve) => (
              <CurveCard
                key={curve.id}
                curve={curve}
                onLoad={() => onLoadCurve(curve)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({ onNewCurve }: { onNewCurve: () => void }) {
  return (
    <div className="border border-dashed border-astro-border rounded-lg p-16 text-center">
      <div className="mx-auto w-14 h-14 mb-5 opacity-20">
        <svg viewBox="0 0 56 56" fill="none" className="text-astro-accent">
          <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M14 28h8M34 28h8M28 14v8M28 34v8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="28" cy="28" r="4" fill="currentColor" opacity="0.6" />
        </svg>
      </div>
      <p className="text-astro-text font-medium mb-1">
        Aún no tienes análisis guardados
      </p>
      <p className="text-astro-muted text-sm mb-6 max-w-xs mx-auto">
        Analiza una curva y usa "Guardar en historial" para que aparezca aquí.
      </p>
      <button
        onClick={onNewCurve}
        className="text-astro-accent text-sm font-medium hover:underline underline-offset-2"
      >
        Cargar primera curva de luz →
      </button>
    </div>
  );
}

function CurveCard({
  curve,
  onLoad,
}: {
  curve: ResumenAnalisis;
  onLoad: () => void;
}) {
  const fecha = new Date(curve.creadoEn).toLocaleString("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const fmt = (v: number | null, dec: number) => (v === null ? "—" : v.toFixed(dec));

  return (
    <button
      onClick={onLoad}
      className="w-full text-left border border-astro-border rounded-lg p-5 bg-astro-surface hover:border-astro-accent/40 hover:bg-astro-surface-2 transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium text-astro-text group-hover:text-astro-accent transition-colors truncate">
            {curve.nombre}
          </p>
          <p className="text-xs text-astro-muted mt-1 font-mono">
            {fecha} · {curve.nPuntos ?? "—"} observaciones
          </p>
        </div>
        <div className="flex gap-5 flex-shrink-0">
          <StatCell label="Período" value={`${fmt(curve.periodo, 4)} d`} />
          <StatCell label="Semiamplitud" value={fmt(curve.amplitud, 3)} />
          <StatCell label="R21" value={fmt(curve.R21, 3)} />
        </div>
      </div>
    </button>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-xs text-astro-muted">{label}</p>
      <p className="text-sm font-mono text-astro-text mt-0.5">{value}</p>
    </div>
  );
}
