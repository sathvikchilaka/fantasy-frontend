import { useParams, useNavigate } from 'react-router-dom'
import { CreateTeam } from './CreateTeam'

export function CreateTeamPage() {
  const { matchId: matchIdParam, action } = useParams<{ matchId: string; action: string }>()
  const navigate = useNavigate()
  const matchId = Number(matchIdParam)

  return (
    <div className="h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
      <CreateTeam
        matchId={matchId}
        action={(action as 'new' | 'edit') ?? 'new'}
        onClose={() => navigate(`/matches/${matchId}`)}
      />
    </div>
  )
}
