// Ruta "/panel": historial de análisis guardados. Requiere sesión.
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import Dashboard from "../components/Dashboard";
import { listarAnalisis } from "../api/analisis";
import { useSesion } from "../context/SesionContext";
import type { ResumenAnalisis } from "../types";

export default function Panel() {
  const { usuario, cargando: cargandoSesion } = useSesion();
  const navigate = useNavigate();
  const [historial, setHistorial] = useState<ResumenAnalisis[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    listarAnalisis()
      .then((r) => setHistorial(r.analisis))
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, [usuario]);

  if (cargandoSesion) return null;
  if (!usuario) return <Navigate to="/login?volver=/panel" replace />;

  return (
    <Dashboard
      history={historial}
      cargando={cargando}
      error={error}
      onNewCurve={() => navigate("/")}
      onLoadCurve={(c) => navigate(`/analisis/${c.id}`)}
    />
  );
}
