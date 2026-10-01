// Ruta "/analisis/:id": abre un análisis guardado. Requiere sesión.
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import AnalysisView from "../components/AnalysisView";
import AppHeader from "../components/AppHeader";
import { obtenerAnalisis } from "../api/analisis";
import { useSesion } from "../context/SesionContext";
import type { Analisis, Reporte } from "../types";

export default function AnalisisGuardado() {
  const { id } = useParams();
  const { usuario, cargando: cargandoSesion } = useSesion();
  const navigate = useNavigate();
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario || !id) return;
    obtenerAnalisis(Number(id))
      .then(setAnalisis)
      .catch((e: Error) => setError(e.message));
  }, [usuario, id]);

  // Los cambios al reporte se ven en pantalla; persistirlos (PATCH) queda pendiente.
  const cambiarReporte = useCallback((reporte: Reporte) => {
    setAnalisis((a) => (a ? { ...a, reporte } : a));
  }, []);

  if (cargandoSesion) return null;
  if (!usuario) return <Navigate to={`/login?volver=/analisis/${id}`} replace />;

  if (!analisis) {
    return (
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center px-6">
          <p className={`text-sm ${error ? "text-astro-red" : "text-astro-muted"}`}>
            {error ?? "Cargando análisis…"}
          </p>
        </main>
      </div>
    );
  }

  return (
    <AnalysisView
      analisis={analisis}
      onReporteChange={cambiarReporte}
      onSave={() => {}}
      estadoGuardado="guardado"
      onBack={() => navigate("/panel")}
      backLabel="Mis análisis"
    />
  );
}
