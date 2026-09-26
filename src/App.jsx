import { Navigate, Route, Routes } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute"
import PublicOnlyRoute from "./components/PublicOnlyRoute/PublicOnlyRoute"
import HomePage from "./pages/HomePage/HomePage"
import RegisterPage from "./pages/RegisterPage/RegisterPage"

function App() {
  return (
    <Routes>
      {/* Rutas públicas: solo accesibles sin sesión */}
      <Route element={<PublicOnlyRoute />}>
        {/* Placeholders: se reemplazan en los tickets de login y registro */}
        <Route path="/login" element={<h1>Login (próximamente)</h1>} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Rutas privadas: requieren sesión */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
      </Route>

      {/* Cualquier otra URL vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App