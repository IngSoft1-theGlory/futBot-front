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
import CreateLeaguePage from "./pages/CreateLeaguePage/CreateLeaguePage"
import FriendlyLobby from "./pages/FriendlyLobby/FriendlyLobby"
import LeagueLobbyPage from "./pages/LeagueLobbyPage/LeagueLobbyPage"
import JoinFriendlyPage from "./pages/JoinFriendlyPage/JoinFriendlyPage"
import JoinLeaguePage from "./pages/JoinLeaguePage/JoinLeaguePage"
import MatchScreenPage from "./pages/MatchScreenPage/MatchScreenPage"
import MatchResultPage from "./pages/MatchResultPage/MatchResultPage"
import BehaviorListPage from "./pages/BehaviorListPage/BehaviorListPage"

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
        <Route path="/leagues/:leagueId" element={<LeagueLobbyPage />}  />
        <Route path="/friendlies/:matchId/join" element={<JoinFriendlyPage />} />
        <Route path="/matches/:matchId" element={<MatchScreenPage />} />
        <Route path="/matches/:matchId/result" element={<MatchResultPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/createplayer" element={<CreatePlayerPage />} />
        <Route path="/friendlies/new" element={<CreateFriendlyPage />} />
        <Route path="/leagues/:leagueId/join" element={<JoinLeaguePage />} />
        <Route path="/leagues/new" element={<CreateLeaguePage />} />
        <Route path="/behaviors" element={<BehaviorListPage />}  />
      </Route>

      {/* Cualquier otra URL vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
