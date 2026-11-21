import { Navigate, Route, Routes, useLocation } from "react-router";
import FlujoAnalisis from "./pages/FlujoAnalisis";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Panel from "./pages/Panel";
import AnalisisGuardado from "./pages/AnalisisGuardado";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="/analisis/:id" element={<AnalisisGuardado />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// La key cambia en cada navegación a "/", así el flujo vuelve a la pantalla de carga
// aunque el usuario ya esté en "/" (por ejemplo, al hacer clic en el logo).
function Inicio() {
  const location = useLocation();
  return <FlujoAnalisis key={location.key} />;
}
