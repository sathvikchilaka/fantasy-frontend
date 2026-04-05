import { useState, useMemo } from 'react'
import type { ApiMatch, ApiPlayer } from '@/types/api'
import { normalizeRole, playerKey, tryAddPlayer, SQUAD_SIZE, type FantasyRole } from '@/fantasy/dream11Rules'
import { playerImageUrl } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { RoleFilterTabs } from '../components/RoleFilterTabs'
import { PlayerPoolCard } from '../components/PlayerPoolCard'
import { SelectedAvatarStrip } from '../components/SelectedAvatarStrip'
import { StatusBanner } from '../components/StatusBanner'
import { ChevronRight } from 'lucide-react'

interface Step1Props {
  players: ApiPlayer[]
  matchMeta: ApiMatch | null
  byId: Map<string, ApiPlayer>
  selected: Set<string>
  selectedList: ApiPlayer[]
  roleCounts: Record<FantasyRole, number>
  creditsLeft: number
  hint: string | null
  squadValid: boolean
  validationErrors: string[]
  t1: string
  t2: string
  t1Id: number | undefined
  t2Id: number | undefined
  nTeam1: number
  nTeam2: number
  onPick: (p: ApiPlayer) => void
  onRemove: (key: string) => void
  onClearAll: () => void
  onNext: () => void
  captainId: string | null
  viceCaptainId: string | null
  apiError: string | null
}

export function Step1PlayerPicker({
  players, matchMeta, byId, selected, selectedList, roleCounts,
  creditsLeft, hint, squadValid, validationErrors,
  t1, t2, t1Id, t2Id, nTeam1, nTeam2,
  onPick, onRemove, onClearAll, onNext,
  captainId, viceCaptainId, apiError,
}: Step1Props) {
  const [roleFilter, setRoleFilter] = useState<'ALL' | FantasyRole>('WK')

  const pool = useMemo(() => {
    const base = roleFilter === 'ALL' ? players : players.filter((p) => normalizeRole(p.type) === roleFilter)
    return {
      team1: base.filter((p) => p.team?.teamId === t1Id),
      team2: base.filter((p) => p.team?.teamId === t2Id),
    }
  }, [players, roleFilter, t1Id, t2Id])

  const renderCard = (p: ApiPlayer) => {
    const pk = playerKey(p)
    const on = selected.has(pk)
    const res = on ? ({ ok: true } as const) : tryAddPlayer(p, selected, byId, matchMeta)
    const disabled = !on && !res.ok
    return (
      <PlayerPoolCard
        key={pk}
        player={p}
        isSelected={on}
        isDisabled={disabled}
        onClick={() => onPick(p)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Status feedback */}
      <StatusBanner
        apiError={apiError}
        hint={hint}
        validationError={selectedList.length === SQUAD_SIZE && validationErrors.length > 0 ? validationErrors[0] : null}
        captainViceError={null}
      />

      {/* Role filters */}
      <RoleFilterTabs
        active={roleFilter}
        roleCounts={roleCounts}
        onChange={setRoleFilter}
        showClearAll={selectedList.length > 0}
        onClearAll={onClearAll}
      />

      {/* Player pool — two team columns */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Team 1 */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2.5">
              {matchMeta?.team1?.imageId && (
                <img
                  src={playerImageUrl(matchMeta.team1.imageId)}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover bg-muted"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider">{t1}</span>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto tabular-nums">{nTeam1}/7</Badge>
            </div>
            <div className="space-y-1.5">
              {pool.team1.length > 0 ? pool.team1.map(renderCard) : (
                <p className="text-xs text-muted-foreground py-4 text-center">No players for this role</p>
              )}
            </div>
          </div>

          {/* Team 2 */}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2.5">
              {matchMeta?.team2?.imageId && (
                <img
                  src={playerImageUrl(matchMeta.team2.imageId)}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover bg-muted"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider">{t2}</span>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 ml-auto tabular-nums">{nTeam2}/7</Badge>
            </div>
            <div className="space-y-1.5">
              {pool.team2.length > 0 ? pool.team2.map(renderCard) : (
                <p className="text-xs text-muted-foreground py-4 text-center">No players for this role</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm">
        {/* Avatar strip */}
        <SelectedAvatarStrip
          selectedList={selectedList}
          captainId={captainId}
          viceCaptainId={viceCaptainId}
          onRemove={onRemove}
        />

        {/* Stats + Next CTA */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Progress */}
          <div className="shrink-0">
            <div className="flex items-baseline gap-0.5">
              <span className="text-lg font-bold tabular-nums">{selectedList.length}</span>
              <span className="text-xs text-muted-foreground">/{SQUAD_SIZE}</span>
            </div>
            <Progress value={(selectedList.length / SQUAD_SIZE) * 100} className="h-1 w-14 mt-0.5" />
          </div>

          {/* Credits */}
          <div className="shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Credits</p>
            <p className="text-sm font-semibold tabular-nums">{creditsLeft.toFixed(1)}</p>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Next button */}
          <Button
            disabled={!squadValid}
            onClick={onNext}
            className="gap-1.5 px-6 h-11 rounded-xl text-sm font-semibold"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
