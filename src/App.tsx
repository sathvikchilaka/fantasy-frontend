import { Navigate, Route, Routes } from 'react-router-dom'
import { RootLayout } from './layouts/RootLayout'
import { CreateTeamPage } from './pages/CreateTeamPage'
import { Home } from './pages/Home'
import { Leaderboard } from './pages/Leaderboard'
import { MatchDetail } from './pages/MatchDetail'
import { Matches } from './pages/Matches'
import { Profile } from './pages/Profile'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route path="matches" element={<Matches />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="matches/:matchId/create/:action" element={<CreateTeamPage />} />
        <Route path="matches/:matchId" element={<MatchDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
