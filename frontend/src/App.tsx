import { Navigate, Route, Routes } from "react-router";
import FlujoAnalisis from "./pages/FlujoAnalisis";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import Panel from "./pages/Panel";
import AnalisisGuardado from "./pages/AnalisisGuardado";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<FlujoAnalisis />} />
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="/analisis/:id" element={<AnalisisGuardado />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
