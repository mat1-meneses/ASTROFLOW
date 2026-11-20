// Lado derecho del header: selectores de idioma y tema + "Iniciar sesión" para invitados,
// o "Mis análisis" + nombre + "Cerrar sesión" con sesión iniciada.
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useSesion } from "../context/SesionContext";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export default function UserMenu() {
  const { t } = useTranslation();
  const { usuario, cargando, cerrar } = useSesion();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  let contenido;

  if (cargando) {
    contenido = <div className="h-8 w-28" />;
  } else if (!usuario) {
    contenido =
      pathname === "/login" || pathname === "/registro" ? null : (
        <Link
          to={`/login?volver=${encodeURIComponent(pathname)}`}
          className="text-sm font-medium text-astro-accent border border-astro-accent/40 rounded px-4 py-1.5 hover:bg-astro-accent/10 transition-colors"
        >
          {t("menu.iniciarSesion")}
        </Link>
      );
  } else {
    contenido = (
      <div className="flex items-center gap-4">
        <Link to="/panel" className="text-sm text-astro-muted hover:text-astro-text transition-colors">
          {t("menu.misAnalisis")}
        </Link>
        <span className="text-sm text-astro-text">{usuario.nombre}</span>
        <button
          type="button"
          onClick={async () => {
            await cerrar();
            navigate("/");
          }}
          className="text-sm text-astro-muted border border-astro-border rounded px-3 py-1.5 hover:text-astro-text hover:border-astro-muted transition-colors"
        >
          {t("menu.cerrarSesion")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <LanguageToggle />
      <ThemeToggle />
      {contenido}
    </div>
  );
}