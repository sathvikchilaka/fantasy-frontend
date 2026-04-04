import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { playerImageUrl } from '../api/client'
import {
  countRoles,
  creditsForPlayer,
  normalizeRole,
  playerKey,
  roleLabel,
  SQUAD_SIZE,
  TOTAL_CREDITS_CAP,
  totalCredits,
  tryAddPlayer,
  type AddBlockReason,
  type FantasyRole,
  validateCompleteSquad,
} from '../fantasy/dream11Rules'
import type { ApiMatch, ApiPlayer } from '../types/api'
import { useMatches, useMatch, useCreateTeam } from '@/hooks/useQueries'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  AlertCircle,
  Check,
  X,
  ChevronLeft,
} from 'lucide-react'

function playerNumericId(p: ApiPlayer): number | null {
  const n = Number.parseInt(p.id, 10)
  return Number.isFinite(n) ? n : null
}

function blockHint(reason: AddBlockReason): string {
  switch (reason) {
    case 'full': return 'Squad full. Remove a player first.'
    case 'credits': return `Exceeds ${TOTAL_CREDITS_CAP} credit cap.`
    case 'team_cap': return 'Max 7 from one team.'
    case 'role_max': return 'Role limit reached.'
    default: return 'Cannot add player.'
  }
}

interface CreateTeamProps {
  matchId: number
  action: 'new' | 'edit'
  onClose: () => void
}

export function CreateTeam({ matchId, action, onClose }: CreateTeamProps) {
  const { data: allMatches = [], isLoading: matchesLoading } = useMatches()
  const { data: matchSelection, isLoading: selectionLoading, error: selectionError } = useMatch(matchId)
  const createTeamMutation = useCreateTeam(matchId)

  const loading = matchesLoading || selectionLoading
  const error = selectionError ? (selectionError instanceof Error ? selectionError.message : 'Failed to load') : null
  const saving = createTeamMutation.isPending
  const [success, setSuccess] = useState(false)

  const matchMeta = useMemo(
    () => allMatches.find((m: ApiMatch) => m.matchId === matchId) ?? null,
    [allMatches, matchId],
  )
  const players = useMemo<ApiPlayer[]>(() => matchSelection?.players ?? [], [matchSelection])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [captainVice, setCaptainVice] = useState<{ captainId: string | null; viceCaptainId: string | null }>({ captainId: null, viceCaptainId: null })
  const captainId = captainVice.captainId
  const viceCaptainId = captainVice.viceCaptainId
  const [roleFilter, setRoleFilter] = useState<'ALL' | FantasyRole>('WK')
  const [hint, setHint] = useState<string | null>(null)

  const byId = useMemo(() => new Map(players.map((p) => [playerKey(p), p] as const)), [players])

  // Hydrate selection from existing dream team in edit mode
  const hydrated = useRef(false)
  useEffect(() => {
    if (action === 'edit' && !hydrated.current && matchSelection?.dreamTeam && players.length > 0) {
      hydrated.current = true
      const team = JSON.parse(matchSelection.dreamTeam.team)
      const ids = new Set<string>(team.properties.map((p: { playerid: number }) => String(p.playerid)))
      setSelected(ids) // eslint-disable-line react-hooks/set-state-in-effect
      const capNumId = String(team.captainPlayerId)
      const vcNumId = String(team.viceCaptainPlayerId)
      const capPlayer = players.find((p) => String(playerNumericId(p)) === capNumId)
      const vcPlayer = players.find((p) => String(playerNumericId(p)) === vcNumId)
      setCaptainVice({
        captainId: capPlayer ? playerKey(capPlayer) : capNumId,
        viceCaptainId: vcPlayer ? playerKey(vcPlayer) : vcNumId,
      })
    }
  }, [action, matchSelection, players])

  const selectedList = useMemo(() => [...selected].map((id) => byId.get(id)).filter(Boolean) as ApiPlayer[], [selected, byId])
  const creditsUsed = useMemo(() => totalCredits(selectedList), [selectedList])
  const creditsLeft = Math.max(0, TOTAL_CREDITS_CAP - creditsUsed)
  const roleCounts = useMemo(() => countRoles(selectedList), [selectedList])

  const t1Id = matchMeta?.team1?.teamId
  const t2Id = matchMeta?.team2?.teamId
  const t1 = matchMeta?.team1?.teamSName ?? matchMeta?.team1?.teamName ?? 'Team 1'
  const t2 = matchMeta?.team2?.teamSName ?? matchMeta?.team2?.teamName ?? 'Team 2'
  const nTeam1 = t1Id == null ? 0 : selectedList.filter((p) => p.team?.teamId === t1Id).length
  const nTeam2 = t2Id == null ? 0 : selectedList.filter((p) => p.team?.teamId === t2Id).length

  const validationErrors = useMemo(() => (selectedList.length === SQUAD_SIZE ? validateCompleteSquad(selectedList) : []), [selectedList])
  const squadValid = selectedList.length === SQUAD_SIZE && validationErrors.length === 0
  const captainViceErrors = useMemo(() => {
    if (selectedList.length !== SQUAD_SIZE) return []
    const errs: string[] = []
    if (!captainId) errs.push('Select a captain (C) in Your XI.')
    if (!viceCaptainId) errs.push('Select a vice-captain (VC).')
    if (captainId && viceCaptainId && captainId === viceCaptainId) errs.push('C and VC must be different.')
    return errs
  }, [selectedList.length, captainId, viceCaptainId])
  const canSave = squadValid && captainViceErrors.length === 0

  const pickPlayer = (p: ApiPlayer) => {
    setHint(null)
    const key = playerKey(p)
    if (selected.has(key)) { setSelected((prev) => { const n = new Set(prev); n.delete(key); return n }); return }
    const res = tryAddPlayer(p, selected, byId, matchMeta)
    if (!res.ok) setHint(blockHint(res.reason))
    else setSelected((prev) => { const n = new Set(prev); n.add(key); return n })
  }

  const selectCaptain = (id: string) => {
    setHint(null)
    setCaptainVice((prev) => {
      if (prev.captainId === id) return { ...prev, captainId: null }
      return { captainId: id, viceCaptainId: prev.viceCaptainId === id ? null : prev.viceCaptainId }
    })
  }

  const selectViceCaptain = (id: string) => {
    setHint(null)
    setCaptainVice((prev) => {
      if (prev.viceCaptainId === id) return { ...prev, viceCaptainId: null }
      return { captainId: prev.captainId === id ? null : prev.captainId, viceCaptainId: id }
    })
  }

  const submit = () => {
    if (!canSave) return
    const capNum = captainId ? playerNumericId(byId.get(captainId)!) : null
    const vcNum = viceCaptainId ? playerNumericId(byId.get(viceCaptainId)!) : null
    if (capNum == null || vcNum == null) return
    const properties = selectedList.map((p) => {
      const pid = playerNumericId(p)
      if (pid == null) throw new Error(`Player id not numeric: ${p.id}`)
      return { playerid: pid, type: normalizeRole(p.type) }
    })
    createTeamMutation.mutate(
      { matchid: matchId, properties, captainPlayerId: capNum, viceCaptainPlayerId: vcNum },
      { onSuccess: () => setSuccess(true) },
    )
  }

  // Pool for current role filter, split by team
  const pool = useMemo(() => {
    const base = roleFilter === 'ALL' ? players : players.filter((p) => normalizeRole(p.type) === roleFilter)
    return {
      team1: base.filter((p) => p.team?.teamId === t1Id),
      team2: base.filter((p) => p.team?.teamId === t2Id),
    }
  }, [players, roleFilter, t1Id, t2Id])

  const roleTabs: Array<'ALL' | FantasyRole> = ['WK', 'BAT', 'AR', 'BOWL', 'ALL']

  // Mobile: tab to switch between pool and squad
  const [mobileTab, setMobileTab] = useState<'pool' | 'squad'>('pool')

  // ── Resizable panel (desktop only) ──
  const [rightWidth, setRightWidth] = useState(360)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDragging.current = true
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const startWidth = rightWidth

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return
      const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX
      const delta = startX - clientX
      const containerWidth = containerRef.current?.offsetWidth ?? 1200
      const newWidth = Math.max(360, Math.min(containerWidth - 720, startWidth + delta))
      setRightWidth(newWidth)
    }
    const onUp = () => {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
  }, [rightWidth])

  const renderPlayerTile = (p: ApiPlayer) => {
    const pk = playerKey(p)
    const on = selected.has(pk)
    const cr = creditsForPlayer(p)
    const role = normalizeRole(p.type)
    const res = on ? ({ ok: true } as const) : tryAddPlayer(p, selected, byId, matchMeta)
    const disabled = !on && !res.ok

    return (
      <button
        key={pk}
        type="button"
        onClick={() => pickPlayer(p)}
        className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
          on ? 'border-primary/50 bg-primary/5' : disabled ? 'opacity-30 cursor-not-allowed' : 'border-transparent bg-muted/40 hover:bg-muted/70'
        }`}
      >
        <img className="h-10 w-10 rounded-full object-cover bg-muted shrink-0" src={playerImageUrl(p.imageId)} alt="" loading="lazy" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{p.name}</p>
          <p className="text-[11px] text-muted-foreground">{role}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums shrink-0 text-muted-foreground">{cr.toFixed(1)}</span>
        {on && <Check className="h-4 w-4 text-primary shrink-0" />}
      </button>
    )
  }

  // ── Layout ──
  return (
    <div className="flex flex-col h-full bg-background">
      {/* ── Top bar ── */}
      <header className="shrink-0 border-b">
        <div className="flex items-center gap-4 px-5 sm:px-8 py-4">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate">{action === 'edit' ? 'Edit' : 'Build'} your squad</p>
            <p className="text-[11px] text-muted-foreground truncate">{t1} vs {t2}</p>
          </div>
          <Button disabled={!canSave || saving || success} onClick={() => void submit()} className="gap-2 shrink-0">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : null}
            {saving ? 'Saving' : success ? 'Saved!' : 'Save squad'}
          </Button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-2.5 md:gap-4 px-5 sm:px-8 pb-4 overflow-x-auto">
          <div className="shrink-0">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums">{selectedList.length}</span>
              <span className="text-xs text-muted-foreground">/{SQUAD_SIZE}</span>
            </div>
            <Progress value={(selectedList.length / SQUAD_SIZE) * 100} className="h-1 w-16 mt-1" />
          </div>
          <Separator orientation="vertical" className="h-6 hidden sm:block" />
          <div className="shrink-0 hidden sm:block">
            <p className="text-xs text-muted-foreground">Credits</p>
            <p className="text-sm font-semibold tabular-nums">{creditsLeft.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">left</span></p>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-1.5 shrink-0">
            {(['WK', 'BAT', 'AR', 'BOWL'] as const).map((r) => (
              <span key={r} className={`text-[10px] rounded px-1.5 py-0.5 tabular-nums ${roleCounts[r] > 0 ? 'bg-primary/10 text-primary font-semibold' : 'bg-muted text-muted-foreground'}`}>
                {r} {roleCounts[r]}
              </span>
            ))}
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{t1} {nTeam1}/7</span>
            <span className="tabular-nums">{t2} {nTeam2}/7</span>
          </div>
        </div>
      </header>

      {/* ── Status bar — single line feedback ── */}
      {(() => {
        const apiError = error || (createTeamMutation.error instanceof Error ? createTeamMutation.error.message : createTeamMutation.error ? 'Save failed' : null)
        if (apiError) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{apiError}</span>
          </div>
        )
        if (hint) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-gold/8 border-b border-gold/15 text-gold text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{hint}</span>
          </div>
        )
        if (selectedList.length === SQUAD_SIZE && validationErrors.length > 0) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{validationErrors[0]}</span>
          </div>
        )
        if (selectedList.length === SQUAD_SIZE && captainViceErrors.length > 0) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-violet-500/8 border-b border-violet-500/15 text-violet-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{captainViceErrors[0]}</span>
          </div>
        )
        return null
      })()}

      {/* ── Body ── */}
      <div ref={containerRef} className="flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex-1 p-6 space-y-3">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : success ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <p className="text-lg font-semibold">Squad saved</p>
            <p className="text-sm text-muted-foreground">Your dream team is locked in.</p>
            <Button variant="outline" onClick={onClose} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            {/* Mobile: tab switcher between pool and squad */}
            <div className="lg:hidden shrink-0 flex border-b">
              <button
                type="button"
                onClick={() => setMobileTab('pool')}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors cursor-pointer ${
                  mobileTab === 'pool' ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground'
                }`}
              >
                Players
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('squad')}
                className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors cursor-pointer relative ${
                  mobileTab === 'squad' ? 'text-foreground border-b-2 border-foreground' : 'text-muted-foreground'
                }`}
              >
                Your XI
                {selectedList.length > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{selectedList.length}</span>
                )}
              </button>
            </div>

            {/* Desktop: side-by-side | Mobile: switched via tab */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

              {/* Player pool */}
              <div className={`flex-1 min-h-0 min-w-0 lg:min-w-[720px] flex flex-col overflow-hidden ${mobileTab !== 'pool' ? 'hidden lg:flex' : 'flex'}`}>
                {/* Role filter */}
                <div className="shrink-0 flex items-center gap-1 h-11 px-4 sm:px-6 border-b overflow-x-auto">
                  {roleTabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRoleFilter(tab)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        roleFilter === tab ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }`}
                    >
                      {tab === 'ALL' ? 'All' : roleLabel(tab)}
                    </button>
                  ))}
                  {selectedList.length > 0 && (
                    <>
                      <div className="w-px h-5 bg-border shrink-0 mx-1" />
                      <button
                        type="button"
                        onClick={() => { setSelected(new Set()); setCaptainVice({ captainId: null, viceCaptainId: null }); setHint(null) }}
                        className="px-3 py-1.5 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Clear all
                      </button>
                    </>
                  )}
                </div>

                {/* Two team columns */}
                <div key={roleFilter} className="flex-1 overflow-y-scroll">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
                    {/* Team 1 */}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        {matchMeta?.team1?.imageId && (
                          <img src={playerImageUrl(matchMeta.team1.imageId)} alt="" className="h-5 w-5 rounded-full object-cover bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider">{t1}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto tabular-nums">{nTeam1}/7</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {pool.team1.length > 0 ? pool.team1.map(renderPlayerTile) : (
                          <p className="text-xs text-muted-foreground py-4 text-center">No players for this role</p>
                        )}
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        {matchMeta?.team2?.imageId && (
                          <img src={playerImageUrl(matchMeta.team2.imageId)} alt="" className="h-5 w-5 rounded-full object-cover bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        )}
                        <span className="text-xs font-semibold uppercase tracking-wider">{t2}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto tabular-nums">{nTeam2}/7</Badge>
                      </div>
                      <div className="space-y-1.5">
                        {pool.team2.length > 0 ? pool.team2.map(renderPlayerTile) : (
                          <p className="text-xs text-muted-foreground py-4 text-center">No players for this role</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drag handle — desktop only */}
              <div
                className="hidden lg:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors group/handle"
                onMouseDown={onDragStart}
                onTouchStart={onDragStart}
              >
                <div className="w-px h-8 bg-border group-hover/handle:bg-primary/40 group-active/handle:bg-primary transition-colors rounded-full" />
              </div>

              {/* Your XI */}
              <div
                className={`w-full lg:border-t-0 lg:min-w-[320px] shrink-0 flex flex-col overflow-hidden bg-card ${mobileTab !== 'squad' ? 'hidden lg:flex' : 'flex'}`}
                style={{ width: typeof window !== 'undefined' && window.innerWidth >= 1024 ? Math.max(360, rightWidth) : undefined }}
              >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between gap-3 h-11 px-5 border-b">
                <h3 className="text-sm font-semibold whitespace-nowrap">Your XI</h3>
                <div className="flex items-center gap-2 min-w-0">
                  {captainId && (
                    <span className="flex items-center gap-1 text-[11px] truncate">
                      <span className="h-4 w-4 rounded bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">C</span>
                      <span className="truncate">{byId.get(captainId)?.name?.split(' ').at(-1) ?? '—'}</span>
                    </span>
                  )}
                  {viceCaptainId && (
                    <span className="flex items-center gap-1 text-[11px] truncate">
                      <span className="h-4 w-4 rounded bg-violet-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">VC</span>
                      <span className="truncate">{byId.get(viceCaptainId)?.name?.split(' ').at(-1) ?? '—'}</span>
                    </span>
                  )}
                  <span className="text-sm font-bold tabular-nums text-primary shrink-0">{selectedList.length}<span className="text-muted-foreground font-normal text-xs">/{SQUAD_SIZE}</span></span>
                </div>
              </div>

              {/* 11 slots — grid on desktop (fits exactly), scroll on mobile */}
              <div className="flex-1 min-h-0 flex flex-col overflow-y-scroll lg:overflow-hidden lg:grid lg:grid-rows-[repeat(11,1fr)] px-2 lg:px-0">
                {Array.from({ length: SQUAD_SIZE }, (_, i) => {
                  const p = selectedList[i]
                  if (!p) {
                    return (
                      <div key={i} className="flex items-center gap-3 px-4 py-3 lg:py-0 border-b border-dashed border-border/10 last:border-0">
                        <span className="text-[11px] text-muted-foreground/20 tabular-nums w-4">{i + 1}</span>
                        <div className="h-px flex-1 border-b border-dashed border-border/10" />
                      </div>
                    )
                  }
                  const role = normalizeRole(p.type)
                  const pk = playerKey(p)
                  const isCap = captainId === pk
                  const isVc = viceCaptainId === pk

                  return (
                    <div key={pk} className="flex items-center gap-3 px-4 py-2.5 lg:py-0 lg:px-3 border-b border-border/8 last:border-0 group/row hover:bg-muted/30 transition-colors">
                      {/* Avatar with C/VC overlay */}
                      <div className="relative shrink-0">
                        <img
                          className={`h-9 w-9 lg:h-7 lg:w-7 rounded-full object-cover bg-muted ${isCap ? 'ring-[1.5px] ring-blue-500' : isVc ? 'ring-[1.5px] ring-violet-500' : ''}`}
                          src={playerImageUrl(p.imageId)} alt=""
                        />
                        {(isCap || isVc) && (
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded text-[7px] font-bold flex items-center justify-center ${isCap ? 'bg-blue-500 text-white' : 'bg-violet-500 text-white'}`}>
                            {isCap ? 'C' : 'VC'}
                          </span>
                        )}
                      </div>

                      {/* Name + meta inline */}
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-[13px] font-medium truncate">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{role}</span>
                      </div>

                      {/* C / VC — always visible */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={(e) => { e.stopPropagation(); selectCaptain(pk) }}
                          className={`h-8 px-2.5 lg:h-7 lg:px-2 rounded-md text-[11px] lg:text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all ${isCap ? 'bg-blue-500 text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-blue-500/15 hover:text-blue-400'}`}>C</button>
                        <button type="button" onClick={(e) => { e.stopPropagation(); selectViceCaptain(pk) }}
                          className={`h-8 px-2 lg:h-7 lg:px-1.5 rounded-md text-[11px] lg:text-[10px] font-bold flex items-center justify-center cursor-pointer transition-all ${isVc ? 'bg-violet-500 text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-violet-500/15 hover:text-violet-400'}`}>VC</button>
                        <button type="button" onClick={() => pickPlayer(p)}
                          className="h-8 w-8 lg:h-7 lg:w-7 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 cursor-pointer opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
