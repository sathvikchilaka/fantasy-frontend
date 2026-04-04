import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getMatchBucket,
  type MatchTab,
} from '../fantasy/matchBucket'
import { useMatches } from '@/hooks/useQueries'
import type { ApiMatch } from '../types/api'
import { playerImageUrl } from '../api/client'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  Calendar,
  AlertCircle,
  Swords,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Radio,
} from 'lucide-react'

const PAGE_SIZE = 9

function formatWhen(startDate: number): string {
  const ms = String(startDate).length <= 10 ? startDate * 1000 : startDate
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

type View = 'current' | 'completed'

function MatchCard({ m }: { m: ApiMatch }) {
  const bucket = getMatchBucket(m)
  const isLive = bucket === 'live'
  const t1 = m.team1?.teamSName ?? m.team1?.teamName ?? '—'
  const t2 = m.team2?.teamSName ?? m.team2?.teamName ?? '—'

  return (
    <Link to={`/matches/${m.matchId}`} className="group block hover:no-underline">
      <div className={`relative rounded-xl border bg-card p-4 transition-all hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 h-full ${
        isLive ? 'border-primary/40 ring-1 ring-primary/20' : ''
      }`}>
        {isLive && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live</span>
          </div>
        )}

        <div className="mb-4">
          <span className="text-[11px] font-medium text-muted-foreground">
            {m.seriesName ?? 'Match'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-muted/80 flex items-center justify-center overflow-hidden shrink-0 border">
              <img
                src={playerImageUrl(m.team1?.imageId ?? 0)}
                alt={t1}
                className="h-full w-full object-cover"
                onError={(e) => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  el.parentElement!.innerHTML = `<span class="text-xs font-bold text-muted-foreground">${t1.charAt(0)}</span>`
                }}
              />
            </div>
            <span className="text-sm font-semibold truncate">{t1}</span>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase shrink-0">vs</span>
          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className="text-sm font-semibold truncate text-right">{t2}</span>
            <div className="h-10 w-10 rounded-lg bg-muted/80 flex items-center justify-center overflow-hidden shrink-0 border">
              <img
                src={playerImageUrl(m.team2?.imageId ?? 0)}
                alt={t2}
                className="h-full w-full object-cover"
                onError={(e) => {
                  const el = e.target as HTMLImageElement
                  el.style.display = 'none'
                  el.parentElement!.innerHTML = `<span class="text-xs font-bold text-muted-foreground">${t2.charAt(0)}</span>`
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground min-w-0">
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {formatWhen(m.startDate)}
            </span>
            {m.venueInfo?.city && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" />
                {m.venueInfo.city}
              </span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
        </div>

        {bucket === 'completed' && m.status && (
          <div className="mt-3 rounded-md bg-muted/50 px-3 py-1.5">
            <p className="text-[11px] text-muted-foreground truncate">{m.status}</p>
          </div>
        )}
      </div>
    </Link>
  )
}

export function Matches() {
  const { data: rows = [], isLoading: loading, error: queryError } = useMatches()
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load matches') : null

  const [view, setView] = useState<View>('current')
  const [page, setPage] = useState(1)

  const { live, upcoming, completed } = useMemo(() => {
    const buckets: Record<MatchTab, ApiMatch[]> = { upcoming: [], live: [], completed: [] }
    for (const m of rows) buckets[getMatchBucket(m)].push(m)
    const startMs = (m: ApiMatch) => String(m.startDate).length <= 10 ? m.startDate * 1000 : m.startDate
    buckets.upcoming.sort((a, b) => startMs(a) - startMs(b))
    buckets.live.sort((a, b) => startMs(a) - startMs(b))
    buckets.completed.sort((a, b) => startMs(b) - startMs(a))
    return { live: buckets.live, upcoming: buckets.upcoming, completed: buckets.completed }
  }, [rows])

  const currentMatches = useMemo(() => [...live, ...upcoming], [live, upcoming])
  const pool = view === 'current' ? currentMatches : completed

  const totalPages = Math.max(1, Math.ceil(pool.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const pageRows = pool.slice(start, start + PAGE_SIZE)

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Matches</h1>
          <p className="text-muted-foreground mt-1">
            Pick a match, then create your dream team
          </p>
        </div>
        <Select value={view} onValueChange={(v) => { setView(v as View); setPage(1) }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Live & Upcoming ({live.length + upcoming.length})</SelectItem>
            <SelectItem value="completed">Completed ({completed.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-4">
              <Skeleton className="h-3 w-24" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-6 mx-auto" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
              <div className="border-t pt-3 flex justify-between">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Swords className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="font-medium">No matches yet</p>
          <p className="text-sm text-muted-foreground mt-1">Check back later for upcoming fixtures</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* Empty view */}
          {pool.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Radio className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground">
                {view === 'current' ? 'No live or upcoming matches right now' : 'No completed matches yet'}
              </p>
            </div>
          )}

          {/* Grid */}
          {pageRows.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageRows.map((m) => (
                <MatchCard key={m.matchId} m={m} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pool.length > PAGE_SIZE && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
              <p className="text-sm text-muted-foreground">
                {start + 1}–{Math.min(start + pageRows.length, pool.length)} of {pool.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={safePage <= 1}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-3 tabular-nums">{safePage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
