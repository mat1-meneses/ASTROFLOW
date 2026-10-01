import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import AppHeader from "../components/AppHeader";
import Campo from "../components/Campo";
import { useSesion } from "../context/SesionContext";
import { rutaSegura } from "../utils/rutaSegura";

export default function Registro() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const volver = rutaSegura(params.get("volver"));
  const { usuario, iniciar } = useSesion();
  const [form, setForm] = useState({ nombre: "", email: "", password: "", confirmar: "" });
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cambiar = (campo: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [campo]: e.target.value });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (new TextEncoder().encode(form.password).length > 72) return setError("La contraseña es demasiado larga.");
    if (form.password !== form.confirmar) return setError("Las contraseñas no coinciden.");
    setError(null);
    setCargando(true);
    try {
      const resp = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nombre: form.nombre, email: form.email, password: form.password }),
      });
      if (resp.status === 409) throw new Error("Ese correo ya está registrado.");
      if (resp.status === 429) throw new Error("Demasiados intentos. Intenta de nuevo en unos minutos.");
      if (!resp.ok) throw new Error("No se pudo crear la cuenta. Revisa los datos ingresados.");
      const { usuario: nuevo } = await resp.json();
      iniciar(nuevo);
      navigate(volver);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
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
          <h1 className="text-2xl font-semibold text-astro-text mb-2">Crear cuenta</h1>
          <p className="text-sm text-astro-muted leading-relaxed">
            Con una cuenta puedes guardar tus análisis y revisarlos después.
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-5">
            <Campo etiqueta="Nombre" id="nombre" required maxLength={100} autoComplete="name"
              value={form.nombre} onChange={cambiar("nombre")} />
            <Campo etiqueta="Correo electrónico" id="email" type="email" required maxLength={254} autoComplete="email"
              value={form.email} onChange={cambiar("email")} />
            <Campo etiqueta="Contraseña" id="password" type="password" required autoComplete="new-password"
              value={form.password} onChange={cambiar("password")} />
            <Campo etiqueta="Confirmar contraseña" id="confirmar" type="password" required autoComplete="new-password"
              value={form.confirmar} onChange={cambiar("confirmar")} />

            {error && <p className="text-sm text-astro-red">{error}</p>}

            <button type="submit" disabled={cargando}
              className="w-full rounded bg-astro-accent py-2.5 text-sm font-semibold text-astro-bg hover:brightness-110 transition-all disabled:opacity-50">
              {cargando ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-astro-muted">
            ¿Ya tienes cuenta?{" "}
            <Link to={`/login?volver=${encodeURIComponent(volver)}`} className="font-medium text-astro-accent hover:underline underline-offset-2">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
