import { useEffect, useRef } from 'react'
import type { ApiPlayer, ApiMatchSelection } from '@/types/api'
import { playerKey } from '@/fantasy/dream11Rules'

/**
 * Seeds the draft state from an existing dream team when editing.
 * Runs once after players load.
 */
export function useHydrateEdit(
  action: 'new' | 'edit',
  matchSelection: ApiMatchSelection | undefined,
  players: ApiPlayer[],
  setSelected: (s: Set<string>) => void,
  setCaptainVice: (cv: { captainId: string | null; viceCaptainId: string | null }) => void,
): void {
  const hydrated = useRef(false)

  useEffect(() => {
    if (action !== 'edit' || hydrated.current || !matchSelection?.dreamTeam || players.length === 0) return
    hydrated.current = true

    const team = JSON.parse(matchSelection.dreamTeam.team)
    const savedIds = new Set(team.properties.map((p: { playerid: number }) => String(p.playerid)))
    const ids = new Set<string>(
      players
        .filter((p) => savedIds.has(String(Number.parseInt(p.id, 10))))
        .map(playerKey)
    )
    setSelected(ids)

    const capNumId = String(team.captainPlayerId)
    const vcNumId = String(team.viceCaptainPlayerId)
    const capPlayer = players.find((p) => String(Number.parseInt(p.id, 10)) === capNumId)
    const vcPlayer = players.find((p) => String(Number.parseInt(p.id, 10)) === vcNumId)
    setCaptainVice({
      captainId: capPlayer ? playerKey(capPlayer) : capNumId,
      viceCaptainId: vcPlayer ? playerKey(vcPlayer) : vcNumId,
    })
  }, [action, matchSelection, players, setSelected, setCaptainVice])
}
