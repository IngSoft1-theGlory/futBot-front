import { Navigate, Route, Routes } from "react-router-dom"
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute"
import PublicOnlyRoute from "./components/PublicOnlyRoute/PublicOnlyRoute"
import HomePage from "./pages/HomePage/HomePage"
import RegisterPage from "./pages/RegisterPage/RegisterPage"
import LoginPage from "./pages/LoginPage/LoginPage"
import CreatePlayerPage from "./pages/PlayersPage/CreatePlayerPage/CreatePlayerPage"
import PlayersPage from "./pages/PlayersPage/PlayersPage"
import FriendlyListPage from "./pages/FriendlyListPage/FriendlyListPage"
import CreateFriendlyPage from "./pages/CreateFriendlyPage/CreateFriendlyPage"
import FriendlyLobby from "./pages/FriendlyLobby/FriendlyLobby"
import JoinFriendlyPage from "./pages/JoinFriendlyPage/JoinFriendlyPage"
function App() {
  return (
    <Routes>
      {/* Rutas públicas: solo accesibles sin sesión */}
      <Route element={<PublicOnlyRoute />}>
        {/* Placeholders: se reemplazan en los tickets de login y registro */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* Rutas privadas: requieren sesión */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/friendlies" element={<FriendlyListPage />} />
        <Route path="/friendlies/:matchId" element={<FriendlyLobby />} />
        <Route path="/friendlies/:matchId/join" element={<JoinFriendlyPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/createplayer" element={<CreatePlayerPage />} />
        <Route path="/friendlies/new" element={<CreateFriendlyPage />} />
      </Route>

      {/* Cualquier otra URL vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App