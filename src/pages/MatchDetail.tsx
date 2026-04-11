import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ApiMatch, ApiPlayer, ScorecardInnings } from "../types/api";
import TeamPreview from "./TeamPreview";
import TeamComparison from "./TeamComparison";
import PlayerStatsTab from "./PlayerStatsTab";
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
import { usePageShortcuts, useKeyboard } from "@/keyboard/useKeyboard";

type DetailTab = "scorecard" | "leaderboard" | "playerstats";
const DETAIL_TABS: DetailTab[] = ["scorecard", "leaderboard", "playerstats"];



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
  return new Date(matchStartTimestampMs(startDate)).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " IST";
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

  const [sheetDid, setSheetDid] = useState<number | null>(null);
  const [sheetTab, setSheetTab] = useState<"squad" | "compare">("squad");
  const [tab, setTab] = useState<DetailTab>("scorecard");
  const tabsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Mobile bottom-sheet detection
  const isMobile = useSyncExternalStore(
    (cb) => { const mql = window.matchMedia("(max-width: 639px)"); mql.addEventListener("change", cb); return () => mql.removeEventListener("change", cb); },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );

  // Bottom-sheet drag-to-dismiss state (mobile only)
  const [dragY, setDragY] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetEntered, setSheetEntered] = useState(false);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const dragYRef = useRef(0);
  const startedInScrollArea = useRef(false);
  const scrolledDuringTouch = useRef(false);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isSheetOpen = sheetDid != null;

  useEffect(() => {
    if (isSheetOpen && isMobile) {
      setSheetVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSheetEntered(true));
      });
    } else if (sheetVisible) {
      setSheetEntered(false);
      const timer = setTimeout(() => setSheetVisible(false), 420);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSheetOpen, isMobile]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (sheetVisible) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [sheetVisible]);

  // Native non-passive touch listeners to prevent pull-to-refresh
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const scrollEl = sheetScrollRef.current;
      const inScrollArea = scrollEl?.contains(e.target as Node);
      startedInScrollArea.current = !!inScrollArea;
      scrolledDuringTouch.current = false;
      dragStartY.current = e.touches[0].clientY;
      // Never start drag from inside scroll area — decide in touchmove
      isDragging.current = !inScrollArea;
    };

    const onTouchMove = (e: TouchEvent) => {
      // For touches in scroll area, decide whether to transition to drag
      if (startedInScrollArea.current && !isDragging.current) {
        const scrollEl = sheetScrollRef.current;
        if (scrollEl && scrollEl.scrollTop > 0) scrolledDuringTouch.current = true;
        if (scrolledDuringTouch.current) return;
        const delta = e.touches[0].clientY - dragStartY.current;
        if (scrollEl && scrollEl.scrollTop <= 0 && delta > 0) {
          isDragging.current = true;
        } else {
          return;
        }
      }
      if (!isDragging.current) return;
      const delta = e.touches[0].clientY - dragStartY.current;
      if (delta > 0) {
        e.preventDefault(); // Block pull-to-refresh
        dragYRef.current = delta;
        setDragY(delta);
      }
    };

    const onTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (dragYRef.current > 120) setSheetDid(null);
      dragYRef.current = 0;
      setDragY(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [sheetVisible]);

  // Stop non-passive parent touchmove from blocking native scroll in the scroll area
  useEffect(() => {
    const scrollEl = sheetScrollRef.current;
    if (!scrollEl) return;

    const onScrollTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) e.stopPropagation();
    };

    scrollEl.addEventListener("touchmove", onScrollTouchMove, { passive: true });
    return () => scrollEl.removeEventListener("touchmove", onScrollTouchMove);
  }, [sheetVisible]);

  // ── Queries ──
  const { data: allMatches = [], isLoading: loading, error: matchesError } = useMatches();
  const { data: matchData } = useMatch(matchId);
  const { data: scRaw, isLoading: scLoading, error: scQueryError } = useScorecard(matchId);
  const { data: lbRows = [], isLoading: lbLoading, error: lbQueryError } = useMatchLeaderboard(matchId);
  const refreshData = useRefreshMatchData(matchId);
  const refreshRef = useRef(refreshData);
  refreshRef.current = refreshData;

  const error = matchesError ? (matchesError instanceof Error ? matchesError.message : "Failed to load") : null;
  const scError = scQueryError ? (scQueryError instanceof Error ? scQueryError.message : "Failed to load scorecard") : null;
  const lbError = lbQueryError ? (lbQueryError instanceof Error ? lbQueryError.message : "Failed to load leaderboard") : null;

  const isTeamCreated = matchData?.dreamTeam != null;
  const myDreamId: number | null = matchData?.dreamTeam?.id ?? null;
  const myLbEntry = useMemo(
    () => lbRows.find((r) => r.did === myDreamId) ?? null,
    [lbRows, myDreamId],
  );
  const sheetLbEntry = useMemo(
    () => sheetDid != null ? lbRows.find((r) => r.did === sheetDid) ?? null : null,
    [lbRows, sheetDid],
  );
  const sheetLbRank = useMemo(() => {
    if (!sheetLbEntry) return 0;
    const sorted = [...lbRows].sort((a, b) => b.totalpoints - a.totalpoints);
    const idx = sorted.indexOf(sheetLbEntry);
    return idx >= 0 ? idx + 1 : 0;
  }, [lbRows, sheetLbEntry]);
  const canShowCompare = sheetDid != null && sheetDid !== myDreamId && myLbEntry != null && sheetLbEntry != null;

  // SSE for live refresh — only connect when match is in progress
  const match = useMemo(
    () => allMatches.find((m: ApiMatch) => m.matchId === matchId) ?? null,
    [allMatches, matchId],
  );
  const teamCreationLocked = match != null && (match.state === "In Progress" || match.state === "Live");
  useEffect(() => {
    if (!teamCreationLocked) return;
    const es = new EventSource(apiUrl("/api/stream/notif/" + matchId));
    es.addEventListener("refresh", () => refreshRef.current());
    es.onerror = () => {};
    return () => { es.close(); };
  }, [matchId, teamCreationLocked]);

  const innings1 = useMemo(() => parseInnings(scRaw?.innings1), [scRaw]);
  const innings2 = useMemo(() => parseInnings(scRaw?.innings2), [scRaw]);

  const team1Name = useMemo(() => resolveTeamName(match, scRaw?.team1, "Team 1"), [match, scRaw]);
  const team2Name = useMemo(() => resolveTeamName(match, scRaw?.team2, "Team 2"), [match, scRaw]);

  const hasScorecard = innings1 != null || innings2 != null;
  const currentInnings = scRaw?.innings ?? 1; // which innings is active (1 or 2)

  const matchResult = match?.teamWon ?? null;
  const playerwon = match?.playerwon ?? null;
  const playerwonPoints = match?.points ?? null;

  const filteredSortedLbRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? lbRows.filter((r) => r.name.toLowerCase().includes(q) || String(r.did ?? "").includes(q))
      : lbRows;
    const copy = [...filtered];
    copy.sort((a, b) => b.totalpoints - a.totalpoints);
    return copy;
  }, [lbRows, query]);

  // Standard competition ranking: tied scores share the same rank, next rank skips
  const lbRanks = useMemo(() => {
    const ranks: number[] = [];
    for (let i = 0; i < filteredSortedLbRows.length; i++) {
      if (i === 0 || filteredSortedLbRows[i].totalpoints !== filteredSortedLbRows[i - 1].totalpoints) {
        ranks.push(i + 1);
      } else {
        ranks.push(ranks[i - 1]);
      }
    }
    return ranks;
  }, [filteredSortedLbRows]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedLbRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filteredSortedLbRows.slice(start, start + pageSize);

  // Cache blob URLs so we don't re-create them every render
  const blobUrlCache = useRef<Map<string, string>>(new Map());
  const avatarUrls = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const row of pageRows) {
      const key = row.imageurl ?? "";
      if (!key) { map.set(key, null); continue; }
      if (blobUrlCache.current.has(key)) {
        map.set(key, blobUrlCache.current.get(key)!);
      } else {
        const url = base64ToBlobUrl(key);
        if (url) blobUrlCache.current.set(key, url);
        map.set(key, url);
      }
    }
    return map;
  }, [pageRows]);

  const t1 = match?.team1?.teamSName ?? match?.team1?.teamName ?? "Team 1";
  const t2 = match?.team2?.teamSName ?? match?.team2?.teamName ?? "Team 2";

  const teamNames = useMemo(() => {
    const m: Record<string, string> = {};
    if (match?.team1) m[String(match.team1.teamId)] = match.team1.teamSName ?? match.team1.teamName ?? "Team 1";
    if (match?.team2) m[String(match.team2.teamId)] = match.team2.teamSName ?? match.team2.teamName ?? "Team 2";
    return m;
  }, [match]);

  const now = useSyncExternalStore(subscribeNow, getNowSnapshot, getServerNowSnapshot);
  // Show "Sugar ah?" when kickoff is more than 24h away.
  const squadEditingLocked =
    match != null &&
    (() => {
      const startMs = matchStartTimestampMs(match.startDate);
      const windowStartMs = startMs - 24 * 60 * 60 * 1000;
      return now <= windowStartMs;
    })();

  const navigate = useNavigate();
  const { isDisabled: off } = useKeyboard();

  usePageShortcuts("match-detail", (e: KeyboardEvent) => {
    if (e.key === "1" && !off("md-tab-1")) { setTab("scorecard"); setPage(1); setQuery(""); return true; }
    if (e.key === "2" && !off("md-tab-2")) { setTab("leaderboard"); setPage(1); setQuery(""); return true; }
    if (e.key === "3" && !off("md-tab-3")) { setTab("playerstats"); setPage(1); setQuery(""); return true; }

    if ((e.key === "t" || e.key === "ArrowRight") && !off("md-cycle") && !off("md-arrows")) {
      e.preventDefault();
      const next = DETAIL_TABS[(DETAIL_TABS.indexOf(tab) + 1) % DETAIL_TABS.length];
      setTab(next); setPage(1); setQuery("");
      return true;
    }
    if (e.key === "ArrowLeft" && !off("md-arrows")) {
      e.preventDefault();
      const prev = DETAIL_TABS[(DETAIL_TABS.indexOf(tab) - 1 + DETAIL_TABS.length) % DETAIL_TABS.length];
      setTab(prev); setPage(1); setQuery("");
      return true;
    }

    if (e.key === "l" && !off("md-lb")) { setTab("leaderboard"); setPage(1); setQuery(""); return true; }

    if (e.key === "c" && !off("md-create") && match && !teamCreationLocked && !squadEditingLocked && match.state !== "Completed") {
      navigate(`/matches/${match.matchId}/create/${isTeamCreated ? "edit" : "new"}`);
      return true;
    }

    if (e.key === "Escape" && sheetDid != null) {
      setSheetDid(null);
      return true;
    }

    return false;
  });

  if (!Number.isFinite(matchId)) {
    return (
      <div className="container pt-8">
        <p className="text-muted-foreground">Invalid match.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/matches">Back to matches</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container pt-8">
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

      {/* Sheet — desktop: Radix side-sheet, mobile: custom bottom-sheet */}
      {!isMobile && (
        <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) setSheetDid(null) }}>
          <SheetContent side="right" className="p-0 flex flex-col overflow-hidden sm:max-w-md">
            <SheetTitle className="sr-only">
              {sheetTab === "compare" ? "Compare Teams" : "Squad Preview"}
            </SheetTitle>
            {/* Tab toggle — only when viewing someone else's team */}
            {canShowCompare && (
              <div data-tour="matchdetail-compare-toggle" className="relative flex backdrop-blur-md bg-white/10 border border-white/15 rounded-full p-0.5 mx-4 mt-14 shrink-0">
                <div
                  className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out"
                  style={{ transform: sheetTab === "compare" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
                />
                <button type="button" className={`flex-1 text-[13px] font-medium py-2 rounded-full relative z-10 cursor-pointer transition-colors duration-200 ${sheetTab === "squad" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setSheetTab("squad")}>
                  Their Squad
                </button>
                <button type="button" className={`flex-1 text-[13px] font-medium py-2 rounded-full relative z-10 cursor-pointer transition-colors duration-200 ${sheetTab === "compare" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setSheetTab("compare")}>
                  Compare
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              {sheetDid != null && sheetTab === "squad" && (
                <TeamPreview matchId={matchId} dreamId={sheetDid} lbEntry={sheetLbEntry} teamNames={teamNames} />
              )}
              {sheetTab === "compare" && canShowCompare && (
                <TeamComparison
                  myEntry={myLbEntry!}
                  theirEntry={sheetLbEntry!}
                  theirRank={sheetLbRank}
                  teamNames={teamNames}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {isMobile && sheetVisible && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50"
            style={{ opacity: sheetEntered ? 1 : 0, transition: "opacity 300ms ease" }}
            onClick={() => setSheetDid(null)}
          />

          {/* Bottom sheet */}
          <div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[92vh] rounded-t-3xl overflow-hidden bg-background"
            style={{
              boxShadow: "0 -6px 20px rgba(255, 255, 255, 0.08), 0 -1px 6px rgba(255, 255, 255, 0.05)",
              transform: `translateY(${!sheetEntered ? "100%" : dragY > 0 ? `${dragY}px` : "0"})`,
              transition: dragY > 0 ? "none" : "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {/* Drag handle */}
            <div className="absolute top-0 inset-x-0 z-20 flex justify-center py-3 rounded-t-3xl backdrop-blur-md" style={{ touchAction: "none" }}>
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
            </div>

            {/* Tab toggle — only when viewing someone else's team */}
            {canShowCompare && (
              <div className="relative flex backdrop-blur-md bg-white/10 border border-white/15 rounded-full p-0.5 mx-4 mt-10 mb-1 shrink-0 z-10">
                <div
                  className="absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out"
                  style={{ transform: sheetTab === "compare" ? "translateX(calc(100% + 4px))" : "translateX(0)" }}
                />
                <button type="button" className={`flex-1 text-[13px] font-medium py-2 rounded-full relative z-10 cursor-pointer transition-colors duration-200 ${sheetTab === "squad" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setSheetTab("squad")}>
                  Their Squad
                </button>
                <button type="button" className={`flex-1 text-[13px] font-medium py-2 rounded-full relative z-10 cursor-pointer transition-colors duration-200 ${sheetTab === "compare" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setSheetTab("compare")}>
                  Compare
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div ref={sheetScrollRef} className="overflow-y-auto flex-1 min-h-0 pt-2" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
              {sheetDid != null && sheetTab === "squad" && (
                <TeamPreview matchId={matchId} dreamId={sheetDid} lbEntry={sheetLbEntry} teamNames={teamNames} />
              )}
              {sheetTab === "compare" && canShowCompare && (
                <TeamComparison
                  myEntry={myLbEntry!}
                  theirEntry={sheetLbEntry!}
                  theirRank={sheetLbRank}
                  teamNames={teamNames}
                />
              )}
            </div>
          </div>
        </>
      )}

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
                  <Badge variant={match.state === "Completed" ? "secondary" : "emerald"}
                    className="mt-2">
                      {formatWhen(match.startDate)}
                    {match.venueInfo?.ground ? ` · ${match.venueInfo.ground.length > 35 ? match.venueInfo.ground.substring(0, 35) + "..." : match.venueInfo.ground}` : ""}
                    {match.venueInfo?.city ? ` · ${match.venueInfo.city}` : ""}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isTeamCreated && myDreamId != null && (
                  <Button variant="outline" onClick={() => { setSheetDid(myDreamId); setSheetTab("squad"); }}>
                    View my squad
                  </Button>
                  )}
                  {!teamCreationLocked && match.state !== "Completed" &&
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
              {(matchResult || scRaw?.matchstatus) && (
                <div className={`mt-6 -mx-6 -mb-6 px-6 py-3.5 border-t ${
                  matchResult
                    ? 'bg-linear-to-r from-primary/10 via-primary/15 to-primary/10 border-primary/20'
                    : 'border-border/60'
                }`}>
                  <div className="flex items-center justify-center gap-2.5">
                    {matchResult ? (
                      <>
                        <span className="text-xl leading-none">🏆</span>
                        <span className="font-bold text-primary text-base tracking-wide">{matchResult}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">{scRaw!.matchstatus}</span>
                    )}
                  </div>
                  {match.state === "Completed" && playerwon && (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">Fantasy Winner:</span>
                      <span className="text-sm font-semibold">{playerwon}</span>
                      {playerwonPoints != null && (
                        <span className="text-xs text-muted-foreground">({playerwonPoints.toFixed(1)} pts)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs ref={tabsRef} value={tab} onValueChange={(v) => {
            setTab(v as DetailTab);
            setPage(1);
            setQuery("");
            tabsRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
          }} data-tour="matchdetail-tabs">
            <TabsList className="mb-4">
              <TabsTrigger value="scorecard">Scorecard</TabsTrigger>
              <TabsTrigger value="leaderboard" data-tour="matchdetail-leaderboard-tab">Leaderboard</TabsTrigger>
              <TabsTrigger value="playerstats" data-tour="matchdetail-playerstats-tab">Player Stats</TabsTrigger>
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
                  {match.state === "Completed" && matchResult ? (
                    <p className="text-primary font-semibold">{matchResult}</p>
                  ) : (
                    <p className="text-muted-foreground">Aree ruko ji..</p>
                  )}
                </div>
              )}
              {!scLoading && !scError && hasScorecard && (
                <div className="space-y-4">

                  {/* Score banner */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-around gap-4">
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground mb-1">{team1Name}</p>
                          <p className={`text-2xl font-bold tabular-nums ${innings1 && innings2 && innings1.total.runs >= innings2.total.runs ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {innings1 ? `${innings1.total.runs}/${innings1.total.wickets}` : "—"}
                          </p>
                          {innings1 && <p className="text-xs text-muted-foreground">({innings1.total.overs} Ov)</p>}
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">VS</span>
                        <div className="text-center">
                          <p className="text-sm font-medium text-muted-foreground mb-1">{team2Name}</p>
                          <p className={`text-2xl font-bold tabular-nums ${innings1 && innings2 && innings2.total.runs >= innings1.total.runs ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                      defaultOpen={currentInnings === 1}
                    />
                  )}
                  {innings2 && (
                    <InningsSection
                      innings={innings2}
                      teamName={team2Name}
                      label="2nd Innings"
                      defaultOpen={currentInnings === 2}
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
                        data-search=""
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
                        <SelectItem value="15">15 rows</SelectItem>
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
                      const rank = lbRanks[start + i] ?? (start + i + 1);
                      const avatarUrl = avatarUrls.get(row.imageurl ?? "") ?? null;
                      const canPreview = teamCreationLocked || match.state === "Completed" || row.did === myDreamId;
                      const isTop3 = rank <= 3;
                      const isMyRow = row.did === myDreamId;
                      return (
                        <div
                          key={`${row.email}-${rank}`}
                          className={`grid grid-cols-[36px_1fr_auto_40px] sm:grid-cols-[36px_40px_1fr_auto_48px] gap-2 items-center px-3 py-2.5 rounded-lg transition-colors ${
                            isMyRow ? 'bg-primary/6 border border-primary/15' : isTop3 ? 'bg-foreground/4 border border-foreground/10' : 'bg-muted/30 hover:bg-muted/50'
                          } ${canPreview ? 'cursor-pointer' : ''}`}
                          onClick={() => { if (canPreview && row.did != null) { setSheetDid(row.did); setSheetTab("squad"); } }}
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
                          <div className="min-w-0">
                            <span className="text-sm font-medium truncate block">{row.name}</span>
                            {isMyRow && <span className="text-[10px] text-primary font-medium">You</span>}
                          </div>

                          {/* Points */}
                          <div className="text-right">
                            <span className={`tabular-nums ${isTop3 ? 'text-sm font-bold text-primary' : 'text-sm font-semibold'}`}>
                              {row.totalpoints.toFixed(1)}
                            </span>
                            {rank !== 1 && filteredSortedLbRows[0] && (
                              <p className="text-[10px] tabular-nums text-muted-foreground/60 leading-tight">
                                {(row.totalpoints - filteredSortedLbRows[0].totalpoints).toFixed(1)}
                              </p>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex justify-center">
                            {canPreview && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={row.did == null}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (row.did != null) { setSheetDid(row.did); setSheetTab("squad"); }
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

                  {/* Pagination — only show when more than one page */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={safePage <= 1}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-3 tabular-nums">
                        {safePage} / {totalPages}
                      </span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Player Stats */}
            <TabsContent value="playerstats">
              <PlayerStatsTab
                lbRows={lbRows}
                lbLoading={lbLoading}
                lbError={lbError}
                matchPlayers={(matchData?.players ?? []) as ApiPlayer[]}
                dreamTeam={matchData?.dreamTeam ?? null}
                innings1={innings1}
                innings2={innings2}
                isLive={teamCreationLocked}
                match={match}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
