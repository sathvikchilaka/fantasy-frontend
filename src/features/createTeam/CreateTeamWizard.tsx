import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePageShortcuts, useKeyboard } from '@/keyboard/useKeyboard'
import type { ApiMatch, ApiPlayer } from '@/types/api'
import {
  creditsForPlayer,
  normalizeRole,
  playerKey,
  roleLabel,
  SQUAD_SIZE,
  tryAddPlayer,
  type FantasyRole,
  getEffectiveCategory,
} from '@/fantasy/dream11Rules'
import { playerImageUrl } from '@/api/client'
import { getTeamColors } from '@/fantasy/teamColors'
import { useMatches, useMatch, useCreateTeam } from '@/hooks/useQueries'
import { useTeamDraft } from './useTeamDraft'
import { useHydrateEdit } from './useHydrateEdit'

// Steps (mobile)
import { Step1PlayerPicker } from './steps/Step1PlayerPicker'
import { Step2CaptainPicker } from './steps/Step2CaptainPicker'
import { StepIndicator, TeamDots } from './components/StepIndicator'

// Desktop-shared UI
import { CategorySection } from './components/CategorySection'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, AlertCircle, Check, X, ChevronLeft, Sparkles } from 'lucide-react'
import { Kbd } from '@/components/ui/kbd'

// Hoisted for useSyncExternalStore (must be stable references)
const MOBILE_MQ = '(max-width: 1023px)'
function subscribeMobile(cb: () => void) {
  const mql = window.matchMedia(MOBILE_MQ)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}
function getMobileSnapshot() { return window.matchMedia(MOBILE_MQ).matches }
function getMobileServerSnapshot() { return false }

interface CreateTeamWizardProps {
  matchId: number
  action: 'new' | 'edit'
  onClose: () => void
}

export function CreateTeamWizard({ matchId, action, onClose }: CreateTeamWizardProps) {
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

  const draft = useTeamDraft(players, matchMeta)
  useHydrateEdit(action, matchSelection, players, draft.setSelected, draft.setCaptainVice)

  const t1 = matchMeta?.team1?.teamSName ?? matchMeta?.team1?.teamName ?? 'Team 1'
  const t2 = matchMeta?.team2?.teamSName ?? matchMeta?.team2?.teamName ?? 'Team 2'
  const t1Id = matchMeta?.team1?.teamId
  const t2Id = matchMeta?.team2?.teamId

  const apiError = error || (createTeamMutation.error instanceof Error ? createTeamMutation.error.message : createTeamMutation.error ? 'Save failed' : null)
  const isAnnounced = matchSelection?.isannounced ?? false

  // ── Benched players dialog (edit mode) ──
  const [benchedDialogOpen, setBenchedDialogOpen] = useState(false)
  const [benchedPlayers, setBenchedPlayers] = useState<ApiPlayer[]>([])
  const benchedChecked = useRef(false)

  useEffect(() => {
    if (action !== 'edit' || !isAnnounced || benchedChecked.current || draft.selectedList.length === 0 || players.length === 0) return
    benchedChecked.current = true
    const benched = draft.selectedList.filter(
      (p) => getEffectiveCategory(p, isAnnounced) === 'bench',
    )
    if (benched.length > 0) {
      setBenchedPlayers(benched)
      setBenchedDialogOpen(true)
    }
  }, [action, draft.selectedList, players, isAnnounced])

  const handleRemoveBenched = () => {
    for (const p of benchedPlayers) draft.removePlayer(playerKey(p))
    setBenchedDialogOpen(false)
    setBenchedPlayers([])
  }

  const benchedDialog = (
    <Dialog open={benchedDialogOpen} onOpenChange={setBenchedDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Players moved to bench
          </DialogTitle>
          <DialogDescription>
            {benchedPlayers.length === 1
              ? 'A player you previously selected has been moved to the bench.'
              : `${benchedPlayers.length} players you previously selected have been moved to the bench.`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-56 overflow-y-auto space-y-1.5 py-1">
          {benchedPlayers.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40">
              <img
                className="h-8 w-8 rounded-full object-cover bg-muted shrink-0"
                src={playerImageUrl(p.imageId)}
                alt=""
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.team?.teamSName} · {normalizeRole(p.type)}</p>
              </div>
              <span className="text-[10px] text-amber-500 font-medium shrink-0">Bench</span>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setBenchedDialogOpen(false)}>Keep them</Button>
          <Button variant="destructive" onClick={handleRemoveBenched}>Remove all</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // Mobile detection
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot)

  // ── Mobile 2-step wizard ──
  const [step, setStep] = useState<1 | 2>(1)
  const [discardOpen, setDiscardOpen] = useState(false)

  // ── Smart XI ──
  const [smartXILoading, setSmartXILoading] = useState(false)
  const [smartXIPicked, setSmartXIPicked] = useState(false)
  const [smartXIPhase, setSmartXIPhase] = useState<'idle' | 'analyzing' | 'picking' | 'done'>('idle')

  const smartTeam = matchSelection?.smartTeam ?? null

  const handleSmartXI = useCallback(() => {
    if (!smartTeam?.players?.length) return

    setSmartXILoading(true)
    setSmartXIPhase('analyzing')

    // Phase 1: "Analyzing players…" (0–1.2s)
    setTimeout(() => setSmartXIPhase('picking'), 1200)

    // Phase 2: "Building your XI…" — apply BE smart team at 1.8s
    setTimeout(() => {
      const keys = new Set<string>(smartTeam.players.map((p: ApiPlayer) => playerKey(p)))
      draft.setSelected(keys)
      draft.setCaptainVice({
        captainId: String(smartTeam.captain),
        viceCaptainId: String(smartTeam.vicecaptain),
      })
      setSmartXIPicked(true)
    }, 1800)

    // Phase 3: Show "done" briefly, then transition
    setTimeout(() => setSmartXIPhase('done'), 2400)
    setTimeout(() => {
      setSmartXIPhase('idle')
      setSmartXILoading(false)
      setStep(2)
    }, 3000)
  }, [smartTeam, draft])

  const handleSubmit = () => {
    const payload = draft.buildPayload()
    if (!payload) return
    createTeamMutation.mutate(
      { matchid: matchId, ...payload },
      { onSuccess: () => setSuccess(true) },
    )
  }

  const handleBack = () => {
    if (step === 2) setStep(1)
    else if (action === 'new' && draft.selectedList.length > 0) setDiscardOpen(true)
    else onClose()
  }

  // ── Success screen (shared) ──
  if (!loading && success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Check className="h-7 w-7 text-primary" />
        </div>
        <p className="text-lg font-semibold">Squad saved</p>
        <p className="text-sm text-muted-foreground">Your dream team is locked in.</p>
        <Button variant="outline" onClick={onClose} className="mt-2">Close</Button>
      </div>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-3">
        {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    )
  }

  // ── Smart XI thinking overlay ──
  if (smartXIPhase !== 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 bg-background">
        {/* Animated icon */}
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {smartXIPhase === 'done'
              ? <Check className="h-7 w-7 text-primary animate-in zoom-in-50 duration-300" />
              : <Sparkles className="h-7 w-7 text-primary animate-pulse" />
            }
          </div>
          {smartXIPhase !== 'done' && (
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          )}
        </div>

        {/* Phase text */}
        <div className="text-center space-y-1.5">
          <p className="text-lg font-semibold animate-in fade-in duration-300">
            {smartXIPhase === 'analyzing' && 'Analyzing players…'}
            {smartXIPhase === 'picking' && 'Building your XI…'}
            {smartXIPhase === 'done' && 'Smart XI ready'}
          </p>
          <p className="text-sm text-muted-foreground">
            {smartXIPhase === 'analyzing' && 'Evaluating credits, roles, and form'}
            {smartXIPhase === 'picking' && 'Picking the strongest balanced lineup'}
            {smartXIPhase === 'done' && 'Captain and vice-captain assigned'}
          </p>
        </div>

        {/* Progress dots */}
        {smartXIPhase !== 'done' && (
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Mobile wizard ──
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-background">
        {benchedDialog}
        <StepIndicator
          step={step}
          onBack={handleBack}
          title={step === 1 ? 'Select Players' : 'Choose C & VC'}
          subtitle={`${t1} vs ${t2}`}
          teamCounts={step === 1 ? { t1, t2, nTeam1: draft.nTeam1, nTeam2: draft.nTeam2 } : undefined}
        />

        {/* Slide container — both steps always mounted */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div
            className="flex h-full w-[200%] transition-transform duration-300 ease-in-out"
            style={{ transform: step === 1 ? 'translateX(0)' : 'translateX(-50%)' }}
          >
            <div className="w-1/2 h-full flex flex-col overflow-hidden">
              <Step1PlayerPicker
                players={players}
                matchMeta={matchMeta}
                byId={draft.byId}
                selected={draft.selected}
                selectedList={draft.selectedList}
                roleCounts={draft.roleCounts}
                creditsLeft={draft.creditsLeft}
                hint={draft.hint}
                squadValid={draft.squadValid}
                validationErrors={draft.validationErrors}
                t1={t1} t2={t2} t1Id={t1Id} t2Id={t2Id}
                onPick={draft.pickPlayer}
                onClearAll={draft.clearAll}
                onNext={() => setStep(2)}
                onSmartXI={handleSmartXI}
                smartXILoading={smartXILoading}
                captainId={draft.captainId}
                viceCaptainId={draft.viceCaptainId}
                apiError={apiError}
                isAnnounced={isAnnounced}
              />
            </div>
            <div className="w-1/2 h-full flex flex-col overflow-hidden">
              <Step2CaptainPicker
                selectedList={draft.selectedList}
                captainId={draft.captainId}
                viceCaptainId={draft.viceCaptainId}
                captainViceErrors={draft.captainViceErrors}
                smartXIPicked={smartXIPicked}
                onDismissSmartHint={() => setSmartXIPicked(false)}
                onSelectCaptain={(key) => {
                  draft.setCaptainVice((prev) => {
                    if (prev.captainId === key) return { ...prev, captainId: null }
                    return { captainId: key, viceCaptainId: prev.viceCaptainId === key ? null : prev.viceCaptainId }
                  })
                }}
                onSelectViceCaptain={(key) => {
                  draft.setCaptainVice((prev) => {
                    if (prev.viceCaptainId === key) return { ...prev, viceCaptainId: null }
                    return { captainId: prev.captainId === key ? null : prev.captainId, viceCaptainId: key }
                  })
                }}
                onRemove={draft.removePlayer}
                onSave={handleSubmit}
                canSave={draft.canSave}
                saving={saving}
                success={success}
              />
            </div>
          </div>
        </div>

        {/* Discard confirmation (edit mode only) */}
        <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Discard changes?</DialogTitle>
              <DialogDescription>
                Your changes will be lost if you go back now.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
              <Button variant="destructive" onClick={() => { setDiscardOpen(false); onClose() }}>Discard</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // ── Desktop layout (preserved from original CreateTeam) ──
  return <>{benchedDialog}<DesktopCreateTeam
    matchId={matchId}
    action={action}
    onClose={onClose}
    draft={draft}
    players={players}
    matchMeta={matchMeta}
    t1={t1} t2={t2} t1Id={t1Id} t2Id={t2Id}
    apiError={apiError}
    saving={saving}
    success={success}
    onSubmit={handleSubmit}
    onSmartXI={handleSmartXI}
    smartXILoading={smartXILoading}
    smartXIPicked={smartXIPicked}
    onDismissSmartHint={() => setSmartXIPicked(false)}
    isAnnounced={isAnnounced}
  /></>
}

// ═══════════════════════════════════════════════════════════════
// Desktop layout — preserves the original side-by-side design
// ═══════════════════════════════════════════════════════════════

interface DesktopProps {
  matchId: number
  action: 'new' | 'edit'
  onClose: () => void
  draft: ReturnType<typeof useTeamDraft>
  players: ApiPlayer[]
  matchMeta: ApiMatch | null
  t1: string; t2: string; t1Id: number | undefined; t2Id: number | undefined
  apiError: string | null
  saving: boolean
  success: boolean
  onSubmit: () => void
  onSmartXI: () => void
  smartXILoading: boolean
  smartXIPicked: boolean
  onDismissSmartHint: () => void
  isAnnounced: boolean
}

function DesktopCreateTeam({
  action, onClose, draft, players, matchMeta,
  t1, t2, t1Id, t2Id, apiError, saving, success, onSubmit,
  onSmartXI, smartXILoading, smartXIPicked, onDismissSmartHint, isAnnounced,
}: DesktopProps) {
  const [roleFilter, setRoleFilter] = useState<'ALL' | FantasyRole>('WK')
  const [rightWidth, setRightWidth] = useState(360)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const {
    selected, selectedList, byId, roleCounts, creditsLeft,
    hint, validationErrors, captainViceErrors, canSave,
    nTeam1, nTeam2, captainId, viceCaptainId,
    pickPlayer, clearAll, removePlayer,
  } = draft

  const pool = useMemo(() => {
    const base = roleFilter === 'ALL' ? players : players.filter((p) => normalizeRole(p.type) === roleFilter)
    return {
      team1: base.filter((p) => p.team?.teamId === t1Id),
      team2: base.filter((p) => p.team?.teamId === t2Id),
    }
  }, [players, roleFilter, t1Id, t2Id])

  const roleTabs: Array<'ALL' | FantasyRole> = ['WK', 'BAT', 'AR', 'BOWL', 'ALL']

  // ── Keyboard shortcuts (desktop only) ──
  const { isDisabled: off } = useKeyboard()
  usePageShortcuts('team-builder', (e: KeyboardEvent) => {
    if (e.key === 's' && !off('tb-smart') && !smartXILoading) { onSmartXI(); return true }
    if (e.key === 'Enter' && !off('tb-save') && canSave && !saving && !success) {
      if (smartXIPicked) setConfirmOpen(true)
      else onSubmit()
      return true
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !off('tb-remove') && selectedList.length > 0) {
      const last = selectedList[selectedList.length - 1]
      removePlayer(playerKey(last))
      return true
    }
    return false
  })

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

  const selectCaptain = (id: string) => {
    draft.setCaptainVice((prev) => {
      if (prev.captainId === id) return { ...prev, captainId: null }
      return { captainId: id, viceCaptainId: prev.viceCaptainId === id ? null : prev.viceCaptainId }
    })
  }

  const selectViceCaptain = (id: string) => {
    draft.setCaptainVice((prev) => {
      if (prev.viceCaptainId === id) return { ...prev, viceCaptainId: null }
      return { captainId: prev.captainId === id ? null : prev.captainId, viceCaptainId: id }
    })
  }

  const renderPlayerTile = (p: ApiPlayer) => {
    const pk = playerKey(p)
    const on = selected.has(pk)
    const cr = creditsForPlayer(p)
    const role = normalizeRole(p.type)
    const res = on ? ({ ok: true } as const) : tryAddPlayer(p, selected, byId, matchMeta)
    const disabled = !on && !res.ok
    const colors = getTeamColors(p.team?.teamSName)
    return (
      <button
        key={pk}
        type="button"
        onClick={() => pickPlayer(p)}
        className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
          on ? colors.selected : disabled ? 'opacity-30 cursor-not-allowed' : 'border-transparent bg-muted/40 hover:bg-muted/70'
        }`}
      >
        <img className="h-10 w-10 rounded-full object-cover bg-muted shrink-0" src={playerImageUrl(p.imageId)} alt="" loading="lazy" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{p.name}</p>
          <p className="text-[11px] text-muted-foreground">{role}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums shrink-0 text-muted-foreground">{cr.toFixed(1)}</span>
        {on && <Check className={`h-4 w-4 shrink-0 ${colors.check}`} />}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Top bar */}
      <header className="shrink-0 border-b">
        <div className="flex items-center gap-4 px-5 sm:px-8 py-4">
          <button onClick={() => action === 'new' && selectedList.length > 0 ? setDiscardOpen(true) : onClose()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold truncate">{action === 'edit' ? 'Edit' : 'Build'} your squad</p>
            <p className="text-[11px] text-muted-foreground truncate">{t1} vs {t2}</p>
          </div>
          <Button variant="outline" disabled={smartXILoading} onClick={onSmartXI} title="Auto-pick a balanced XI based on player credits, role balance, and team diversity" className="gap-1.5 shrink-0" data-tour="createteam-smart-xi">
            <Sparkles className="h-4 w-4" />
            {smartXILoading ? 'Picking…' : 'Smart XI'}
            <Kbd>S</Kbd>
          </Button>
          <Button disabled={!canSave || saving || success} onClick={() => smartXIPicked ? setConfirmOpen(true) : onSubmit()} className="gap-2 shrink-0" data-tour="createteam-save">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : smartXIPicked ? <Sparkles className="h-4 w-4" /> : null}
            {saving ? 'Saving' : success ? 'Saved!' : smartXIPicked ? 'Save Smart XI' : 'Save squad'}
            <Kbd>↵</Kbd>
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
          <Separator orientation="vertical" className="h-6" />
          <div className="shrink-0">
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
          <div className="flex flex-col gap-0.5 shrink-0">
            <TeamDots label={t1} count={nTeam1} max={7} filledClass={getTeamColors(t1).dot} />
            <TeamDots label={t2} count={nTeam2} max={7} filledClass={getTeamColors(t2).dot} />
          </div>
        </div>
      </header>

      {/* Smart XI hint */}
      {smartXIPicked && (
        <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-primary/5 border-b border-primary/15">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-primary">Smart XI picked a balanced lineup for you. Feel free to swap players or change C/VC before saving.</span>
          <button type="button" onClick={onDismissSmartHint} className="ml-auto text-primary/40 hover:text-primary cursor-pointer">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Status bar */}
      {(() => {
        if (apiError) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{apiError}</span>
          </div>
        )
        if (hint) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-gold/8 border-b border-gold/15 text-gold text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{hint}</span>
          </div>
        )
        if (selectedList.length === SQUAD_SIZE && validationErrors.length > 0) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{validationErrors[0]}</span>
          </div>
        )
        if (selectedList.length === SQUAD_SIZE && captainViceErrors.length > 0) return (
          <div className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-2 bg-violet-500/8 border-b border-violet-500/15 text-violet-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /><span>{captainViceErrors[0]}</span>
          </div>
        )
        return null
      })()}

      {/* Body — side by side */}
      <div ref={containerRef} className="flex-1 min-h-0 flex flex-row">
        {/* Player pool */}
        <div className="flex-1 min-h-0 min-w-[720px] flex flex-col overflow-hidden">
          {/* Role filter */}
          <div className="shrink-0 flex items-center gap-1 h-11 px-6 border-b overflow-x-auto">
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
                  onClick={() => clearAll()}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer whitespace-nowrap"
                >
                  Clear all
                </button>
              </>
            )}
          </div>

          {/* Two team columns */}
          <div key={roleFilter} className="flex-1 overflow-y-scroll">
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  {matchMeta?.team1?.imageId && (
                    <img src={playerImageUrl(matchMeta.team1.imageId)} alt="" className="h-5 w-5 rounded-full object-cover bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider">{t1}</span>
                </div>
                {pool.team1.length > 0 ? (
                  <CategorySection players={pool.team1} isAnnounced={isAnnounced} renderCard={renderPlayerTile} />
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No players for this role</p>
                )}
              </div>
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  {matchMeta?.team2?.imageId && (
                    <img src={playerImageUrl(matchMeta.team2.imageId)} alt="" className="h-5 w-5 rounded-full object-cover bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider">{t2}</span>
                </div>
                {pool.team2.length > 0 ? (
                  <CategorySection players={pool.team2} isAnnounced={isAnnounced} renderCard={renderPlayerTile} />
                ) : (
                  <p className="text-xs text-muted-foreground py-4 text-center">No players for this role</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Drag handle */}
        <div
          className="w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-primary/10 active:bg-primary/20 transition-colors group/handle flex"
          onMouseDown={onDragStart}
          onTouchStart={onDragStart}
        >
          <div className="w-px h-8 bg-border group-hover/handle:bg-primary/40 group-active/handle:bg-primary transition-colors rounded-full" />
        </div>

        {/* Your XI panel */}
        <div
          className="min-w-[320px] shrink-0 flex flex-col overflow-hidden bg-card"
          style={{ width: rightWidth }}
        >
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
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate block">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.team?.teamSName ?? p.team?.teamName ?? ''} · {role}</span>
                  </div>
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

      {/* Smart XI confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Save Smart XI?
            </DialogTitle>
            <DialogDescription>
              This lineup was auto-generated by Smart XI. Make sure you've reviewed the captain and vice-captain picks before locking it in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Go back</Button>
            <Button onClick={() => { setConfirmOpen(false); onSubmit() }} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Confirm & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation (edit mode only) */}
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Your changes will be lost if you go back now.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button>
            <Button variant="destructive" onClick={() => { setDiscardOpen(false); onClose() }}>Discard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
