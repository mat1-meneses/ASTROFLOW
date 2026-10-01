import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import AppHeader from "../components/AppHeader";
import Campo from "../components/Campo";
import { useSesion } from "../context/SesionContext";
import { rutaSegura } from "../utils/rutaSegura";

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const volver = rutaSegura(params.get("volver"));
  const { usuario, iniciar } = useSesion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      const resp = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (resp.status === 429) throw new Error("Demasiados intentos. Intenta de nuevo en unos minutos.");
      if (!resp.ok) throw new Error("Correo o contraseña incorrectos.");
      const { usuario: nuevo } = await resp.json();
      iniciar(nuevo);
      navigate(volver);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setCargando(false);
    }
  }

  if (usuario) return <Navigate to={volver} replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-astro-text mb-2">Iniciar sesión</h1>
          <p className="text-sm text-astro-muted leading-relaxed">
            Inicia sesión para guardar tus análisis. Puedes analizar curvas sin una cuenta.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-5">
            <Campo etiqueta="Correo electrónico" id="email" type="email" required
              autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Campo etiqueta="Contraseña" id="password" type="password" required
              autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />

            {error && <p className="text-sm text-astro-red">{error}</p>}

            <button type="submit" disabled={cargando}
              className="w-full rounded bg-astro-accent py-2.5 text-sm font-semibold text-astro-bg hover:brightness-110 transition-all disabled:opacity-50">
              {cargando ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-astro-muted">
            ¿No tienes cuenta?{" "}
            <Link to={`/registro?volver=${encodeURIComponent(volver)}`} className="font-medium text-astro-accent hover:underline underline-offset-2">
              Crear cuenta
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
