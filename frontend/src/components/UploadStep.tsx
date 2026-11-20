import { useRef, useState } from "react";
import AppHeader from "./AppHeader";
import { Trans, useTranslation } from "react-i18next";

interface Props {
  onFileLoaded: (content: string, name: string) => void;
  onUseExample: () => void;
  /** Solo se muestra "Volver al panel" si se entrega (usuario con sesión). */
  onBack?: () => void;
  cargandoEjemplo?: boolean;
  /** Error detectado fuera del componente (archivo sin datos, ejemplo no encontrado). */
  errorExterno?: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

export default function UploadStep({ onFileLoaded, onUseExample, onBack, cargandoEjemplo, errorExterno }: Props) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    setError(null);
    if (!file.name.match(/\.(csv|txt|dat|tsv|asc)$/i)) {
      setError("carga.errores.formato");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("carga.errores.tamano");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      onFileLoaded(e.target?.result as string, file.name);
    };
    reader.onerror = () => setError("carga.errores.lectura");
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-astro-muted hover:text-astro-text mb-8 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 2L4 7l5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("carga.volver")}
          </button>
          )}

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-astro-text mb-2">
              {t("carga.titulo")}
            </h1>
            <p className="text-sm text-astro-muted leading-relaxed">
              <Trans
                i18nKey="carga.descripcion"
                components={{ code: <span className="font-mono text-astro-text" /> }}
              />
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-14 text-center cursor-pointer
              transition-all select-none
              ${
                dragging
                  ? "border-astro-accent bg-astro-accent/5"
                  : "border-astro-border hover:border-astro-accent/50 hover:bg-astro-surface"
              }
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.txt,.dat,.tsv,.asc"
              className="hidden"
              onChange={handleChange}
            />
            <div
              className={`mx-auto w-10 h-10 mb-4 transition-colors ${
                dragging ? "text-astro-accent" : "text-astro-muted"
              }`}
            >
              <svg viewBox="0 0 40 40" fill="none">
                <path
                  d="M20 28V12M12 20l8-8 8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M8 32h24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-astro-text">
              {dragging ? t("carga.soltar") : t("carga.arrastrar")}
            </p>
            <p className="text-xs text-astro-muted mt-2">
              {t("carga.formatos")}
            </p>
          </div>

          {(error || errorExterno) && (
            <div className="mt-3 flex items-center gap-2 text-sm text-astro-red bg-astro-red/5 border border-astro-red/20 rounded px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              {error ? t(error) : errorExterno}
            </div>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-astro-border" />
            <span className="text-xs text-astro-muted font-mono">{t("carga.separador")}</span>
            <div className="flex-1 h-px bg-astro-border" />
          </div>

          <button
            onClick={onUseExample}
            disabled={cargandoEjemplo}
            className="mt-5 w-full border border-astro-border rounded-lg p-4 hover:border-astro-accent/40 hover:bg-astro-surface transition-all text-left flex items-center justify-between group"
          >
            <div>
              <p className="text-sm font-medium text-astro-text group-hover:text-astro-accent transition-colors">
                {cargandoEjemplo ? t("carga.ejemplo.cargando") : t("carga.ejemplo.usar")}
              </p>
              <p className="text-xs text-astro-muted mt-0.5">
                {t("carga.ejemplo.detalle")}
              </p>
            </div>
            <svg
              className="w-4 h-4 text-astro-muted group-hover:text-astro-accent transition-colors flex-shrink-0 ml-4"
              viewBox="0 0 16 16"
              fill="none"
            >
              <path
                d="M4 8h8M9 5l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}