import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, useParams } from "react-router-dom";
import type { ApiMatch, ScorecardInnings } from "../types/api";
import TeamPreview from "./TeamPreview";
import { apiUrl } from "../api/client";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  useMatches,
  useMatch,
  useScorecard,
  useMatchLeaderboard,
  useRefreshMatchData,
} from "@/hooks/useQueries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  Eye,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
} from "lucide-react";

type DetailTab = "scorecard" | "leaderboard";

/** Normalizes API start date (seconds or ms) to milliseconds since epoch. */
function matchStartTimestampMs(startDate: number): number {
  return String(startDate).length <= 10 ? startDate * 1000 : startDate;
}

const NOW_POLL_MS = 10_000;

/** Cached instant — must not call Date.now() inside getSnapshot (new value every call → infinite re-renders). */
let nowMsCache = Date.now();

function subscribeNow(onStoreChange: () => void): () => void {
  nowMsCache = Date.now();
  const id = window.setInterval(() => {
    nowMsCache = Date.now();
    onStoreChange();
  }, NOW_POLL_MS);
  return () => window.clearInterval(id);
}

function getNowSnapshot(): number {
  return nowMsCache;
}

function getServerNowSnapshot(): number {
  return 0;
}

function formatWhen(startDate: number): string {
  return new Date(matchStartTimestampMs(startDate)).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function base64ToBlobUrl(base64: string | null | undefined): string | null {
  if (!base64) return null;
  try {
    const raw = window.atob(base64);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    const blob = new Blob([uInt8Array], { type: "image/png" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function parseInnings(raw: string | null | undefined): ScorecardInnings | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      batting: (parsed.batting ?? []).map((b: Record<string, unknown>) => ({
        name: b.name ?? "",
        dismissal: b.dismissal ?? "not out",
        runs: b.runs ?? 0,
        balls: b.balls ?? 0,
        fours: b.fours ?? 0,
        sixes: b.sixes ?? 0,
        sr: b.sr ?? 0,
      })),
      bowling: (parsed.bowling ?? []).map((bw: Record<string, unknown>) => ({
        name: bw.name ?? "",
        overs: bw.overs ?? 0,
        maidens: bw.maidens ?? 0,
        runs: bw.runs ?? 0,
        wickets: bw.wickets ?? 0,
        economy: bw.economy ?? 0,
        wides: bw.wides ?? 0,
        nb: bw.nb ?? 0,
      })),
      extras: {
        total: parsed.extras?.total ?? 0,
        wides: parsed.extras?.wides ?? 0,
        noBalls: parsed.extras?.noBalls ?? 0,
        byes: parsed.extras?.byes ?? 0,
        legByes: parsed.extras?.legByes ?? 0,
        penalty: parsed.extras?.penalty ?? 0,
      },
      total: {
        runs: parsed.total?.runs ?? 0,
        wickets: parsed.total?.wickets ?? 0,
        overs: parsed.total?.overs ?? 0,
        runRate: parsed.total?.runRate ?? 0,
      },
    };
  } catch {
    return null;
  }
}

function resolveTeamName(
  match: ApiMatch | null,
  teamIdStr: string | undefined,
  fallback: string,
): string {
  if (!match || !teamIdStr) return fallback;
  const tid = Number(teamIdStr);
  if (match.team1?.teamId === tid)
    return match.team1.teamSName ?? match.team1.teamName ?? fallback;
  if (match.team2?.teamId === tid)
    return match.team2.teamSName ?? match.team2.teamName ?? fallback;
  return fallback;
}

/* Scorecard View */
function ScorecardView({
  innings,
}: {
  innings: ScorecardInnings;
}) {
  return (
    <div className="space-y-5">
      {/* Batting */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1 w-1 rounded-full bg-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Batting
          </h3>
        </div>

        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span className="flex-1">Batter</span>
          <span className="w-9 text-right">R</span>
          <span className="w-9 text-right">B</span>
          <span className="w-9 text-right hidden sm:block">4s</span>
          <span className="w-9 text-right hidden sm:block">6s</span>
          <span className="w-11 text-right">SR</span>
        </div>

        <div className="space-y-1">
          {innings.batting.map((b, i) => {
            const isOut = b.dismissal !== "not out";
            const isTopScore = b.runs >= 50;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                  isTopScore ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    !isOut ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground'
                  }`}>
                    {b.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-1 truncate">
                      {b.name}
                      {!isOut && <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 rounded shrink-0">NOT OUT</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 truncate">{b.dismissal}</div>
                  </div>
                </div>
                <span className={`w-9 text-right text-[13px] tabular-nums shrink-0 ${
                  b.runs >= 100 ? 'font-extrabold text-primary' : b.runs >= 50 ? 'font-bold text-gold' : 'font-medium'
                }`}>
                  {b.runs}
                </span>
                <span className="w-9 text-right text-[13px] tabular-nums text-muted-foreground shrink-0">{b.balls}</span>
                <span className="w-9 text-right text-[13px] tabular-nums hidden sm:block shrink-0">{b.fours}</span>
                <span className="w-9 text-right text-[13px] tabular-nums hidden sm:block shrink-0">{b.sixes}</span>
                <span className="w-11 text-right text-[11px] tabular-nums text-muted-foreground shrink-0">{b.sr.toFixed(1)}</span>
              </div>
            );
          })}
        </div>

        {/* Extras + Total */}
        <div className="mt-3 space-y-2 px-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Extras</span>
            <span className="tabular-nums">
              {innings.extras.total}
              <span className="ml-1 text-muted-foreground/60">
                (w {innings.extras.wides}, nb {innings.extras.noBalls}, b {innings.extras.byes}, lb {innings.extras.legByes})
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm font-semibold">Total</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tabular-nums">
                {innings.total.runs}<span className="text-muted-foreground font-normal">/{innings.total.wickets}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {innings.total.overs} Ov · RR {innings.total.runRate.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bowling */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-1 w-1 rounded-full bg-destructive" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bowling
          </h3>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span className="flex-1">Bowler</span>
          <span className="w-9 text-right">O</span>
          <span className="w-9 text-right hidden sm:block">M</span>
          <span className="w-9 text-right">R</span>
          <span className="w-9 text-right">W</span>
          <span className="w-11 text-right">Econ</span>
        </div>

        <div className="space-y-1">
          {innings.bowling.map((bw, i) => {
            const isStarBowler = bw.wickets >= 3;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                  isStarBowler ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                    isStarBowler ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground'
                  }`}>
                    {bw.name.charAt(0)}
                  </div>
                  <span className="text-[13px] font-medium truncate">{bw.name}</span>
                </div>
                <span className="w-9 text-right text-[13px] tabular-nums shrink-0">{bw.overs}</span>
                <span className="w-9 text-right text-[13px] tabular-nums text-muted-foreground hidden sm:block shrink-0">{bw.maidens}</span>
                <span className="w-9 text-right text-[13px] tabular-nums shrink-0">{bw.runs}</span>
                <span className={`w-9 text-right text-[13px] tabular-nums font-semibold shrink-0 ${isStarBowler ? 'text-primary' : ''}`}>
                  {bw.wickets}
                </span>
                <span className="w-11 text-right text-[11px] tabular-nums text-muted-foreground shrink-0">{bw.economy.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Collapsible innings section — both shown, each toggleable */
function InningsSection({
  innings,
  teamName,
  label,
  defaultOpen = true,
}: {
  innings: ScorecardInnings;
  teamName: string;
  label: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">{teamName}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm font-bold tabular-nums">
            {innings.total.runs}/{innings.total.wickets}
          </span>
          <span className="text-xs text-muted-foreground">
            ({innings.total.overs} Ov)
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="p-4">
          <ScorecardView innings={innings} />
        </div>
      )}
    </div>
  );
}

/* Main Match Detail Page */
export function MatchDetail() {
  const { matchId: mid } = useParams<{ matchId: string }>();
  const matchId = Number(mid);

  const [previewDid, setPreviewDid] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>("scorecard");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ── Queries ──
  const { data: allMatches = [], isLoading: loading, error: matchesError } = useMatches();
  const { data: matchData } = useMatch(matchId);
  const { data: scRaw, isLoading: scLoading, error: scQueryError } = useScorecard(matchId);
  const { data: lbRows = [], isLoading: lbLoading, error: lbQueryError } = useMatchLeaderboard(matchId);
  const refreshData = useRefreshMatchData(matchId);

  const error = matchesError ? (matchesError instanceof Error ? matchesError.message : "Failed to load") : null;
  const scError = scQueryError ? (scQueryError instanceof Error ? scQueryError.message : "Failed to load scorecard") : null;
  const lbError = lbQueryError ? (lbQueryError instanceof Error ? lbQueryError.message : "Failed to load leaderboard") : null;

  const isTeamCreated = matchData?.dreamTeam != null;
  const myDreamId: number | null = matchData?.dreamTeam?.id ?? null;

  // SSE for live refresh
  useEffect(() => {
    const es = new EventSource(apiUrl("/api/stream/notif/" + matchId));
    es.addEventListener("refresh", () => refreshData());
    es.onerror = () => {};
    return () => { es.close(); };
  }, [matchId, refreshData]);

  const match = useMemo(
    () => allMatches.find((m: ApiMatch) => m.matchId === matchId) ?? null,
    [allMatches, matchId],
  );

  const innings1 = useMemo(() => parseInnings(scRaw?.innings1), [scRaw]);
  const innings2 = useMemo(() => parseInnings(scRaw?.innings2), [scRaw]);

  const team1Name = useMemo(() => resolveTeamName(match, scRaw?.team1, "Team 1"), [match, scRaw]);
  const team2Name = useMemo(() => resolveTeamName(match, scRaw?.team2, "Team 2"), [match, scRaw]);

  const hasScorecard = innings1 != null || innings2 != null;

  const matchResult = useMemo(() => {
    if (!match || match.state !== "Completed") return null;
    if (!innings1 || !innings2) return scRaw?.matchstatus ?? null;
    if (innings1.total.runs > innings2.total.runs)
      return `${team1Name} won by ${innings1.total.runs - innings2.total.runs} runs`;
    if (innings2.total.runs > innings1.total.runs)
      return `${team2Name} won by ${10 - innings2.total.wickets} wickets`;
    return "Match tied";
  }, [innings1, innings2, team1Name, team2Name, scRaw]);

  const filteredSortedLbRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? lbRows.filter((r) => r.name.toLowerCase().includes(q) || String(r.did ?? "").includes(q))
      : lbRows;
    const copy = [...filtered];
    copy.sort((a, b) => b.totalpoints - a.totalpoints);
    return copy;
  }, [lbRows, query]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedLbRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filteredSortedLbRows.slice(start, start + pageSize);

  const t1 = match?.team1?.teamSName ?? match?.team1?.teamName ?? "Team 1";
  const t2 = match?.team2?.teamSName ?? match?.team2?.teamName ?? "Team 2";

  const now = useSyncExternalStore(subscribeNow, getNowSnapshot, getServerNowSnapshot);
  // Create/Edit squad only when kickoff is under 24h away (and not after start).
  const squadEditingLocked =
    match != null &&
    (() => {
      const startMs = matchStartTimestampMs(match.startDate);
      const windowStartMs = startMs - 24 * 60 * 60 * 1000;
      return now <= windowStartMs || now >= startMs;
    })();

  if (!Number.isFinite(matchId)) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Invalid match.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/matches">Back to matches</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/matches" className="hover:text-foreground transition-colors flex items-center gap-1 hover:no-underline">
          <ChevronLeft className="h-4 w-4" />
          Matches
        </Link>
        <span>/</span>
        <span className="text-foreground">{match ? `${t1} vs ${t2}` : "Match"}</span>
      </nav>

      {loading && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-center gap-3 pt-6 text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {!loading && !error && !match && (
        <div className="flex flex-col items-center py-20">
          <p className="text-muted-foreground mb-4">Match not found</p>
          <Button asChild>
            <Link to="/matches">Back to matches</Link>
          </Button>
        </div>
      )}

      {/* Team preview sheet */}
      <Sheet open={previewDid != null} onOpenChange={(open) => { if (!open) setPreviewDid(null) }}>
        <SheetContent side="right" className="p-0 flex flex-col overflow-hidden sm:max-w-md">
          <SheetTitle className="sr-only">Squad Preview</SheetTitle>
          {previewDid != null && (
            <TeamPreview matchId={matchId} dreamId={previewDid} />
          )}
        </SheetContent>
      </Sheet>


      {!loading && match && (
        <>
          {/* Hero */}
          <Card className="mb-6 overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <Badge variant="secondary" className="mb-3">
                    {match.seriesName ?? "Cricket"}
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {t1} <span className="text-muted-foreground font-normal">vs</span> {t2}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatWhen(match.startDate)}
                    {match.venueInfo?.ground ? ` · ${match.venueInfo.ground.length > 35 ? match.venueInfo.ground.substring(0, 35) + "..." : match.venueInfo.ground}` : ""}
                    {match.venueInfo?.city ? ` · ${match.venueInfo.city}` : ""}
                  </p>
                  <Badge
                    variant={match.state === "Completed" ? "secondary" : "emerald"}
                    className="mt-2"
                  >
                    {match.status ?? match.state ?? "—"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isTeamCreated && myDreamId != null && (
                    <Button variant="outline" onClick={() => setPreviewDid(myDreamId)}>
                      View my squad
                    </Button>
                  )}
                  {match.state === "Upcoming" &&
                    (squadEditingLocked ? (
                      <Button type="button" disabled>
                        Sugar ah?
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link
                          to={`/matches/${match.matchId}/create/${isTeamCreated ? "edit" : "new"}`}
                        >
                          {isTeamCreated ? "Edit squad" : "Create squad"}
                        </Link>
                      </Button>
                    ))}
                </div>
              </div>
              {matchResult && (
                <div className="mt-6 -mx-6 -mb-6 px-6 py-4 bg-linear-to-r from-primary/10 via-primary/15 to-primary/10 border-t border-primary/20 flex items-center justify-center gap-3">
                  <span className="text-xl leading-none">🏆</span>
                  <span className="font-bold text-primary text-base tracking-wide">{matchResult}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList className="mb-4">
              <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            {/* Scorecard */}
            <TabsContent value="scorecard">
              {scLoading && (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  <Skeleton className="h-10 w-48 rounded-lg" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              )}
              {scError && (
                <Card className="border-destructive/50">
                  <CardContent className="flex items-center gap-3 pt-6 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {scError}
                  </CardContent>
                </Card>
              )}
              {!scLoading && !scError && !hasScorecard && (
                <div className="flex flex-col items-center py-16 text-center">
                  <p className="text-muted-foreground">Aree ruko ji..</p>
                </div>
              )}
              {!scLoading && !scError && hasScorecard && (
                <div className="space-y-4">
                  {scRaw?.matchstatus && (
                    <Badge variant="secondary" className="text-xs">
                      {scRaw.matchstatus}
                    </Badge>
                  )}

                  {/* Score banner */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-around gap-4">
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground mb-1">{team1Name}</p>
                          <p className={`text-2xl font-bold tabular-nums ${innings1 && innings2 && innings1.total.runs >= innings2.total.runs ? 'text-primary' : ''}`}>
                            {innings1 ? `${innings1.total.runs}/${innings1.total.wickets}` : "—"}
                          </p>
                          {innings1 && <p className="text-xs text-muted-foreground">({innings1.total.overs} Ov)</p>}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">VS</span>
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground mb-1">{team2Name}</p>
                          <p className={`text-2xl font-bold tabular-nums ${innings1 && innings2 && innings2.total.runs >= innings1.total.runs ? 'text-primary' : ''}`}>
                            {innings2 ? `${innings2.total.runs}/${innings2.total.wickets}` : "—"}
                          </p>
                          {innings2 && <p className="text-xs text-muted-foreground">({innings2.total.overs} Ov)</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Both innings stacked */}
                  {innings1 && (
                    <InningsSection
                      innings={innings1}
                      teamName={team1Name}
                      label="1st Innings"
                      defaultOpen
                    />
                  )}
                  {innings2 && (
                    <InningsSection
                      innings={innings2}
                      teamName={team2Name}
                      label="2nd Innings"
                      defaultOpen
                    />
                  )}
                </div>
              )}
            </TabsContent>

            {/* Leaderboard */}
            <TabsContent value="leaderboard">
              {lbLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              )}
              {lbError && (
                <Card className="border-destructive/50">
                  <CardContent className="flex items-center gap-3 pt-6 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    {lbError}
                  </CardContent>
                </Card>
              )}
              {!lbLoading && !lbError && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name..."
                        className="pl-9"
                      />
                    </div>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 rows</SelectItem>
                        <SelectItem value="10">10 rows</SelectItem>
                        <SelectItem value="20">20 rows</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Header */}
                  <div className="grid grid-cols-[36px_1fr_auto_40px] sm:grid-cols-[36px_40px_1fr_auto_48px] gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    <span>#</span>
                    <span className="hidden sm:block"></span>
                    <span>Player</span>
                    <span className="text-right">Points</span>
                    <span></span>
                  </div>

                  {/* Rows */}
                  <div className="space-y-1">
                    {pageRows.map((row, i) => {
                      const rank = start + i + 1;
                      const avatarUrl = base64ToBlobUrl(row.imageurl);
                      const canPreview = match.state !== "Upcoming" || (match.state === "Upcoming" && row.did === myDreamId);
                      const isTop3 = rank <= 3;
                      return (
                        <div
                          key={`${row.email}-${rank}`}
                          className={`grid grid-cols-[36px_1fr_auto_40px] sm:grid-cols-[36px_40px_1fr_auto_48px] gap-2 items-center px-3 py-2.5 rounded-lg transition-colors ${
                            isTop3 ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30 hover:bg-muted/50'
                          } ${canPreview ? 'cursor-pointer' : ''}`}
                          onClick={() => { if (canPreview) setPreviewDid(row.did); }}
                        >
                          {/* Rank */}
                          <span className={`text-sm tabular-nums font-semibold ${
                            rank === 1 ? 'text-gold' : rank === 2 ? 'text-silver' : rank === 3 ? 'text-bronze' : 'text-muted-foreground'
                          }`}>
                            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                          </span>

                          {/* Avatar - hidden on mobile */}
                          <div className="hidden sm:block">
                            <Avatar className="h-8 w-8">
                              {avatarUrl && <AvatarImage src={avatarUrl} />}
                              <AvatarFallback className="text-xs">{row.name?.charAt(0)?.toUpperCase() ?? "?"}</AvatarFallback>
                            </Avatar>
                          </div>

                          {/* Name */}
                          <span className="text-sm font-medium truncate">{row.name}</span>

                          {/* Points */}
                          <span className={`text-right tabular-nums ${isTop3 ? 'text-sm font-bold text-primary' : 'text-sm font-semibold'}`}>
                            {row.totalpoints.toFixed(1)}
                          </span>

                          {/* Preview */}
                          <div className="flex justify-center">
                            {canPreview && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={row.did == null}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (row.did != null) setPreviewDid(row.did);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {pageRows.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground">
                        No leaderboard entries found
                      </div>
                    )}
                  </div>

                  {/* Pagination */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Showing {pageRows.length === 0 ? 0 : start + 1}–{Math.min(start + pageRows.length, filteredSortedLbRows.length)} of {filteredSortedLbRows.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={safePage <= 1}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-3">
                        {safePage} / {totalPages}
                      </span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
