// Flujo principal (ruta "/"): carga → mapeo de columnas → procesamiento → resultados.
// Reemplaza la navegación por estados del App.tsx de Figma para esta parte.
// Cualquier visitante puede analizar; guardar exige sesión (decisión del proyecto).

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import UploadStep from "../components/UploadStep";
import ColumnMappingStep from "../components/ColumnMapping";
import ProcessingScreen from "../components/ProcessingScreen";
import AnalysisView, { type EstadoGuardado } from "../components/AnalysisView";
import { parseFile } from "../data/parseFile";
import { calcularDescriptores, guardarAnalisis } from "../api/analisis";
import { useSesion } from "../context/SesionContext";
import { detectarCalibracion, extraerSerie, inferirTipoBrillo, nombreDesdeArchivo } from "../utils/serie";
import type { Analisis, ColumnMapping, ParsedFile, Reporte, Serie } from "../types";

const CLAVE_PENDIENTE = "astroflow:analisis-pendiente";
const RUTA_EJEMPLO = "/ejemplos/9.5482.957.publc.txt";
const MIN_PUNTOS = 30;

interface ArchivoCargado {
  nombre: string;
  parsed: ParsedFile;
}

type Paso =
  | { tipo: "carga" }
  | { tipo: "mapeo"; archivo: ArchivoCargado }
  | { tipo: "procesando"; archivo: ArchivoCargado; mapeo: ColumnMapping; serie: Serie; error: string | null }
  | { tipo: "analisis"; analisis: Analisis };

/** Análisis que un invitado dejó pendiente al ir a iniciar sesión para guardarlo. */
function leerPendiente(): Analisis | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE_PENDIENTE);
    return crudo ? (JSON.parse(crudo) as Analisis) : null;
  } catch {
    return null;
  }
}

export default function FlujoAnalisis() {
  const { usuario } = useSesion();
  const navigate = useNavigate();

  const [paso, setPaso] = useState<Paso>(() => {
    const pendiente = leerPendiente();
    return pendiente ? { tipo: "analisis", analisis: pendiente } : { tipo: "carga" };
  });
  const [mensaje, setMensaje] = useState<string | null>(() =>
    leerPendiente() ? "Recuperamos tu análisis. Ya puedes guardarlo en tu historial." : null
  );
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("sin-guardar");
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [cargandoEjemplo, setCargandoEjemplo] = useState(false);
  const solicitud = useRef(0); // descarta respuestas de análisis que el usuario abandonó

  // El pendiente se borra después de montar (no en el inicializador: StrictMode lo ejecuta dos veces).
  useEffect(() => {
    sessionStorage.removeItem(CLAVE_PENDIENTE);
  }, []);

  // ─── Carga ────────────────────────────────────────────────────────────────
  function cargarTexto(contenido: string, nombreArchivo: string) {
    const parsed = parseFile(contenido);
    if (parsed.headers.length < 2 || parsed.rows.length === 0) {
      setErrorCarga("No se encontraron columnas de datos en el archivo.");
      return;
    }
    setErrorCarga(null);
    setPaso({ tipo: "mapeo", archivo: { nombre: nombreDesdeArchivo(nombreArchivo), parsed } });
  }

  async function usarEjemplo() {
    setCargandoEjemplo(true);
    setErrorCarga(null);
    try {
      const resp = await fetch(RUTA_EJEMPLO);
      const texto = await resp.text();
      // En desarrollo, Vite responde index.html (200) para archivos que no existen.
      if (!resp.ok || texto.trimStart().toLowerCase().startsWith("<!doctype")) {
        throw new Error(`No se encontró la curva de ejemplo en frontend/public${RUTA_EJEMPLO}.`);
      }
      cargarTexto(texto, "9.5482.957.publc.txt");
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : "No se pudo cargar la curva de ejemplo.");
    } finally {
      setCargandoEjemplo(false);
    }
  }

  // ─── Procesamiento ────────────────────────────────────────────────────────
  function procesar(archivo: ArchivoCargado, mapeo: ColumnMapping, serie: Serie) {
    const id = ++solicitud.current;
    if (serie.time.length < MIN_PUNTOS) {
      setPaso({
        tipo: "procesando", archivo, mapeo, serie,
        error: `Solo hay ${serie.time.length} observaciones válidas con esas columnas; se necesitan al menos ${MIN_PUNTOS}.`,
      });
      return;
    }
    setPaso({ tipo: "procesando", archivo, mapeo, serie, error: null });

    calcularDescriptores(serie)
      .then((resultado) => {
        if (id !== solicitud.current) return;
        setEstadoGuardado("sin-guardar");
        setMensaje(null);
        setPaso({
          tipo: "analisis",
          analisis: {
            nombre: archivo.nombre,
            configuracion: {
              mapeo,
              tipoBrillo: inferirTipoBrillo(mapeo.flux),
              calibracion: detectarCalibracion(archivo.parsed.metadata),
              banda: mapeo.flux,
            },
            serie,
            resultado,
            reporte: null,
          },
        });
      })
      .catch((e: Error) => {
        if (id !== solicitud.current) return;
        setPaso({ tipo: "procesando", archivo, mapeo, serie, error: e.message });
      });
  }

  // ─── Resultados ───────────────────────────────────────────────────────────
  const cambiarReporte = useCallback((reporte: Reporte) => {
    setPaso((p) => (p.tipo === "analisis" ? { ...p, analisis: { ...p.analisis, reporte } } : p));
  }, []);

  function guardar() {
    if (paso.tipo !== "analisis") return;

    if (!usuario) {
      try {
        sessionStorage.setItem(CLAVE_PENDIENTE, JSON.stringify(paso.analisis));
        navigate("/login?volver=/");
      } catch {
        setMensaje("El análisis es demasiado grande para conservarlo mientras inicias sesión. Inicia sesión primero y vuelve a analizar la curva.");
      }
      return;
    }

    setEstadoGuardado("guardando");
    guardarAnalisis(paso.analisis)
      .then(({ id }) => {
        setEstadoGuardado("guardado");
        setMensaje(null);
        setPaso((p) => (p.tipo === "analisis" ? { ...p, analisis: { ...p.analisis, id } } : p));
      })
      .catch((e: Error) => {
        setEstadoGuardado("error");
        setMensaje(e.message);
      });
  }

  function nuevaCurva() {
    solicitud.current++;
    setMensaje(null);
    setErrorCarga(null);
    setPaso({ tipo: "carga" });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  switch (paso.tipo) {
    case "carga":
      return (
        <UploadStep
          onFileLoaded={cargarTexto}
          onUseExample={usarEjemplo}
          onBack={usuario ? () => navigate("/panel") : undefined}
          cargandoEjemplo={cargandoEjemplo}
          errorExterno={errorCarga}
        />
      );

    case "mapeo":
      return (
        <ColumnMappingStep
          parsedFile={paso.archivo.parsed}
          starName={paso.archivo.nombre}
          onConfirm={(mapeo) => procesar(paso.archivo, mapeo, extraerSerie(paso.archivo.parsed.rows, mapeo))}
          onBack={nuevaCurva}
        />
      );

    case "procesando":
      return (
        <ProcessingScreen
          starName={paso.archivo.nombre}
          nPuntos={paso.serie.time.length}
          error={paso.error}
          onRetry={() => procesar(paso.archivo, paso.mapeo, paso.serie)}
          onBack={() => {
            solicitud.current++;
            setPaso({ tipo: "mapeo", archivo: paso.archivo });
          }}
        />
      );

    case "analisis":
      return (
        <AnalysisView
          analisis={paso.analisis}
          onReporteChange={cambiarReporte}
          onSave={guardar}
          estadoGuardado={paso.analisis.id ? "guardado" : estadoGuardado}
          mensajeGuardado={mensaje}
          onBack={nuevaCurva}
          backLabel="Nueva curva"
        />
      );
  }
}
