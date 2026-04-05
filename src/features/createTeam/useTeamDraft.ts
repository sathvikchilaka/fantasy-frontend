import { useMemo, useState } from 'react'
import type { ApiMatch, ApiPlayer } from '@/types/api'
import {
  countRoles,
  creditsForPlayer,
  normalizeRole,
  playerKey,
  SQUAD_SIZE,
  TOTAL_CREDITS_CAP,
  totalCredits,
  tryAddPlayer,
  validateCompleteSquad,
  type AddBlockReason,
  type FantasyRole,
} from '@/fantasy/dream11Rules'

function blockHint(reason: AddBlockReason): string {
  switch (reason) {
    case 'full': return 'Squad full. Remove a player first.'
    case 'credits': return `Exceeds ${TOTAL_CREDITS_CAP} credit cap.`
    case 'team_cap': return 'Max 7 from one team.'
    case 'role_max': return 'Role limit reached.'
    default: return 'Cannot add player.'
  }
}

function playerNumericId(p: ApiPlayer): number | null {
  const n = Number.parseInt(p.id, 10)
  return Number.isFinite(n) ? n : null
}

export interface TeamDraft {
  // State
  selected: Set<string>
  captainId: string | null
  viceCaptainId: string | null
  hint: string | null

  // Derived
  selectedList: ApiPlayer[]
  byId: Map<string, ApiPlayer>
  creditsUsed: number
  creditsLeft: number
  roleCounts: Record<FantasyRole, number>
  nTeam1: number
  nTeam2: number
  squadValid: boolean
  validationErrors: string[]
  captainViceErrors: string[]
  canSave: boolean

  // Actions
  pickPlayer: (p: ApiPlayer) => void
  removePlayer: (key: string) => void
  clearAll: () => void
  assignCaptainVice: (key: string) => void
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>
  setCaptainVice: React.Dispatch<React.SetStateAction<{ captainId: string | null; viceCaptainId: string | null }>>
  buildPayload: () => { properties: { playerid: number; type: string }[]; captainPlayerId: number; viceCaptainPlayerId: number } | null
}

export function useTeamDraft(
  players: ApiPlayer[],
  matchMeta: ApiMatch | null,
): TeamDraft {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [captainVice, setCaptainVice] = useState<{ captainId: string | null; viceCaptainId: string | null }>({
    captainId: null,
    viceCaptainId: null,
  })
  const [hint, setHint] = useState<string | null>(null)

  const { captainId, viceCaptainId } = captainVice

  const byId = useMemo(() => new Map(players.map((p) => [playerKey(p), p] as const)), [players])

  const selectedList = useMemo(
    () => [...selected].map((id) => byId.get(id)).filter(Boolean) as ApiPlayer[],
    [selected, byId],
  )

  const creditsUsed = useMemo(() => totalCredits(selectedList), [selectedList])
  const creditsLeft = Math.max(0, TOTAL_CREDITS_CAP - creditsUsed)
  const roleCounts = useMemo(() => countRoles(selectedList), [selectedList])

  const t1Id = matchMeta?.team1?.teamId
  const t2Id = matchMeta?.team2?.teamId
  const nTeam1 = t1Id == null ? 0 : selectedList.filter((p) => p.team?.teamId === t1Id).length
  const nTeam2 = t2Id == null ? 0 : selectedList.filter((p) => p.team?.teamId === t2Id).length

  const validationErrors = useMemo(
    () => (selectedList.length === SQUAD_SIZE ? validateCompleteSquad(selectedList) : []),
    [selectedList],
  )
  const squadValid = selectedList.length === SQUAD_SIZE && validationErrors.length === 0

  const captainViceErrors = useMemo(() => {
    if (selectedList.length !== SQUAD_SIZE) return []
    const errs: string[] = []
    if (!captainId) errs.push('Select a captain (C).')
    if (!viceCaptainId) errs.push('Select a vice-captain (VC).')
    if (captainId && viceCaptainId && captainId === viceCaptainId) errs.push('C and VC must be different.')
    return errs
  }, [selectedList.length, captainId, viceCaptainId])

  const canSave = squadValid && captainViceErrors.length === 0

  const pickPlayer = (p: ApiPlayer) => {
    setHint(null)
    const key = playerKey(p)
    if (selected.has(key)) {
      setSelected((prev) => { const n = new Set(prev); n.delete(key); return n })
      // Clear C/VC if removed player was captain or vice-captain
      if (captainId === key || viceCaptainId === key) {
        setCaptainVice((prev) => ({
          captainId: prev.captainId === key ? null : prev.captainId,
          viceCaptainId: prev.viceCaptainId === key ? null : prev.viceCaptainId,
        }))
      }
      return
    }
    const res = tryAddPlayer(p, selected, byId, matchMeta)
    if (!res.ok) setHint(blockHint(res.reason))
    else setSelected((prev) => { const n = new Set(prev); n.add(key); return n })
  }

  const removePlayer = (key: string) => {
    setHint(null)
    setSelected((prev) => { const n = new Set(prev); n.delete(key); return n })
    if (captainId === key || viceCaptainId === key) {
      setCaptainVice((prev) => ({
        captainId: prev.captainId === key ? null : prev.captainId,
        viceCaptainId: prev.viceCaptainId === key ? null : prev.viceCaptainId,
      }))
    }
  }

  const clearAll = () => {
    setSelected(new Set())
    setCaptainVice({ captainId: null, viceCaptainId: null })
    setHint(null)
  }

  const assignCaptainVice = (key: string) => {
    setCaptainVice((prev) => {
      // Tap current captain → deselect
      if (prev.captainId === key) return { ...prev, captainId: null }
      // Tap current VC → deselect
      if (prev.viceCaptainId === key) return { ...prev, viceCaptainId: null }
      // No captain → assign captain
      if (prev.captainId === null) return { captainId: key, viceCaptainId: prev.viceCaptainId }
      // Captain set, no VC → assign VC
      if (prev.viceCaptainId === null) return { captainId: prev.captainId, viceCaptainId: key }
      // Both set → replace VC
      return { captainId: prev.captainId, viceCaptainId: key }
    })
  }

  const buildPayload = () => {
    if (!canSave) return null
    const capNum = captainId ? playerNumericId(byId.get(captainId)!) : null
    const vcNum = viceCaptainId ? playerNumericId(byId.get(viceCaptainId)!) : null
    if (capNum == null || vcNum == null) return null
    const properties = selectedList.map((p) => {
      const pid = playerNumericId(p)
      if (pid == null) throw new Error(`Player id not numeric: ${p.id}`)
      return { playerid: pid, type: normalizeRole(p.type) }
    })
    return { properties, captainPlayerId: capNum, viceCaptainPlayerId: vcNum }
  }

  return {
    selected,
    captainId,
    viceCaptainId,
    hint,
    selectedList,
    byId,
    creditsUsed,
    creditsLeft,
    roleCounts,
    nTeam1,
    nTeam2,
    squadValid,
    validationErrors,
    captainViceErrors,
    canSave,
    pickPlayer,
    removePlayer,
    clearAll,
    assignCaptainVice,
    setSelected,
    setCaptainVice,
    buildPayload,
  }
}
