import { useEffect, useState } from "react";

type Tema = "dark" | "light";

function temaInicial(): Tema {
  try {
    return localStorage.getItem("astro-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export default function ThemeToggle() {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    const root = document.documentElement;
    if (tema === "light") root.dataset.theme = "light";
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("astro-theme", tema);
    } catch {
      /* sin almacenamiento: el tema solo dura la sesión */
    }
  }, [tema]);

  const oscuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={() => setTema(oscuro ? "light" : "dark")}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
      className="flex items-center gap-2 text-sm text-astro-muted border border-astro-border rounded px-3 py-1.5 hover:text-astro-text hover:border-astro-muted transition-colors"
    >
      {oscuro ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      {oscuro ? "Modo claro" : "Modo oscuro"}
    </button>
  );
}