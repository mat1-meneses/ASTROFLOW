import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Usuario = { id: number; nombre: string; email: string };

type Sesion = {
  usuario: Usuario | null;
  cargando: boolean;
  iniciar: (usuario: Usuario) => void;
  cerrar: () => Promise<void>;
};

const SesionContext = createContext<Sesion | null>(null);

export function SesionProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { usuario: null }))
      .then((d) => setUsuario(d.usuario))
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);

  async function cerrar() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUsuario(null);
  }

  return (
    <SesionContext value={{ usuario, cargando, iniciar: setUsuario, cerrar }}>
      {children}
    </SesionContext>
  );
}

export function useSesion() {
  const ctx = useContext(SesionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de SesionProvider");
  return ctx;
}
