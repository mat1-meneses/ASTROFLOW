import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  // resolvedLanguage convierte "es-CL" o "en-US" en "es" / "en"
  const actual = i18n.resolvedLanguage === "en" ? "en" : "es";

  const cambiar = (idioma: "es" | "en") => {
    i18n.changeLanguage(idioma);
    document.documentElement.lang = idioma;
  };

  return (
    <div className="flex items-center border border-astro-border rounded text-xs font-mono overflow-hidden">
      {(["es", "en"] as const).map((idioma) => (
        <button
          key={idioma}
          type="button"
          onClick={() => cambiar(idioma)}
          aria-pressed={actual === idioma}
          className={`px-2 py-1 transition-colors ${
            actual === idioma
              ? "bg-astro-accent/15 text-astro-accent"
              : "text-astro-muted hover:text-astro-text"
          }`}
        >
          {idioma.toUpperCase()}
        </button>
      ))}
    </div>
  );
}