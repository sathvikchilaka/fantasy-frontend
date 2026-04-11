import { useMemo, useState, useEffect, useRef } from "react";
import type {
  MatchLeaderboardEntry,
  MatchLbPlayer,
  ScorecardInnings,
  ApiPlayer,
  ApiMatch,
} from "@/types/api";
import { playerImageUrl } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Search,
  ArrowUpDown,
  Crown,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────── */

type PlayerStat = {
  playerId: string;
  name: string;
  team: string;
  role: string;
  imageId: string;
  points: number;
  inMyXI: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  batting?: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    sr: number;
  };
  bowling?: {
    overs: number;
    wickets: number;
    runs: number;
    economy: number;
  };
};

type SortKey = "points-desc" | "points-asc" | "name-asc";
type RoleFilter = "ALL" | "WK" | "BAT" | "AR" | "BOWL";

const ROLE_LABELS: Record<RoleFilter, string> = {
  ALL: "All",
  WK: "WK",
  BAT: "BAT",
  AR: "AR",
  BOWL: "BOWL",
};

/* ── Helpers ──────────────────────────────────────────── */

/** Normalize name for best-effort scorecard join */
function normName(n: string): string {
  return n.toLowerCase().replace(/[^a-z]/g, "");
}

/** Resolve a team ID string to a short team name using match data */
function resolveTeamLabel(teamIdStr: string, match: ApiMatch | null): string {
  if (!match || !teamIdStr) return teamIdStr;
  const tid = Number(teamIdStr);
  if (match.team1?.teamId === tid)
    return match.team1.teamSName ?? match.team1.teamName ?? teamIdStr;
  if (match.team2?.teamId === tid)
    return match.team2.teamSName ?? match.team2.teamName ?? teamIdStr;
  return teamIdStr;
}

function buildPlayerStats(
  lbRows: MatchLeaderboardEntry[],
  matchPlayers: ApiPlayer[],
  dreamTeam: any | null,
  innings1: ScorecardInnings | null,
  innings2: ScorecardInnings | null,
  match: ApiMatch | null,
): PlayerStat[] {
  // 1) Deduplicate players from leaderboard
  const playerMap = new Map<string, MatchLbPlayer>();
  for (const row of lbRows) {
    for (const p of row.playerEntities ?? []) {
      if (!playerMap.has(p.playerid)) {
        playerMap.set(p.playerid, p);
      }
    }
  }

  // 2) If leaderboard is empty, fall back to match players
  if (playerMap.size === 0 && matchPlayers.length > 0) {
    for (const p of matchPlayers) {
      playerMap.set(p.id, {
        playerid: p.id,
        points: 0,
        team: p.team?.teamSName ?? p.team?.teamName ?? "",
        name: p.name,
        type: p.type ?? "BAT",
        url: String(p.imageId ?? ""),
      });
    }
  }

  // 3) Parse dream team for My XI identification
  let myXIIds = new Set<string>();
  let captainId: string | null = null;
  let vcId: string | null = null;
  if (dreamTeam) {
    try {
      const parsed =
        typeof dreamTeam.team === "string"
          ? JSON.parse(dreamTeam.team)
          : dreamTeam.team;
      if (parsed?.properties) {
        myXIIds = new Set(
          parsed.properties.map((p: { playerid: number }) =>
            String(p.playerid),
          ),
        );
      }
      if (parsed?.captainPlayerId) captainId = String(parsed.captainPlayerId);
      if (parsed?.viceCaptainPlayerId) vcId = String(parsed.viceCaptainPlayerId);
    } catch {
      /* graceful fallback */
    }
  }

  // 4) Build batting/bowling lookup by normalized name
  const battingMap = new Map<
    string,
    PlayerStat["batting"]
  >();
  const bowlingMap = new Map<
    string,
    PlayerStat["bowling"]
  >();
  for (const inn of [innings1, innings2]) {
    if (!inn) continue;
    for (const b of inn.batting) {
      const key = normName(b.name);
      const existing = battingMap.get(key);
      if (existing) {
        // Merge across innings (Tests/ODIs)
        existing.runs += b.runs;
        existing.balls += b.balls;
        existing.fours += b.fours;
        existing.sixes += b.sixes;
        existing.sr = existing.balls > 0 ? (existing.runs / existing.balls) * 100 : 0;
      } else {
        battingMap.set(key, {
          runs: b.runs,
          balls: b.balls,
          fours: b.fours,
          sixes: b.sixes,
          sr: b.sr,
        });
      }
    }
    for (const bw of inn.bowling) {
      const key = normName(bw.name);
      const existing = bowlingMap.get(key);
      if (existing) {
        existing.overs += bw.overs;
        existing.wickets += bw.wickets;
        existing.runs += bw.runs;
        existing.economy = existing.overs > 0 ? existing.runs / existing.overs : 0;
      } else {
        bowlingMap.set(key, {
          overs: bw.overs,
          wickets: bw.wickets,
          runs: bw.runs,
          economy: bw.economy,
        });
      }
    }
  }

  // 5) Assemble final list
  const stats: PlayerStat[] = [];
  for (const [pid, p] of playerMap) {
    const numericId = String(Number.parseInt(pid, 10));
    const nk = normName(p.name);
    stats.push({
      playerId: pid,
      name: p.name,
      team: resolveTeamLabel(p.team ?? "", match),
      role: normalizeRole(p.type),
      imageId: p.url ?? "",
      points: p.points ?? 0,
      inMyXI: myXIIds.has(pid) || myXIIds.has(numericId),
      isCaptain: captainId === pid || captainId === numericId,
      isViceCaptain: vcId === pid || vcId === numericId,
      batting: battingMap.get(nk),
      bowling: bowlingMap.get(nk),
    });
  }

  return stats;
}

function normalizeRole(type: string | undefined): string {
  if (!type) return "BAT";
  const up = type.toUpperCase();
  if (up.includes("KEEP") || up === "WK") return "WK";
  if (up.includes("ALL") || up === "AR") return "AR";
  if (up.includes("BOWL") || up === "BOWL") return "BOWL";
  return "BAT";
}

/* ── Components ───────────────────────────────────────── */

function PlayerAvatar({
  player,
  size = "md",
}: {
  player: PlayerStat;
  size?: "sm" | "md" | "lg";
}) {
  const [imgErr, setImgErr] = useState(false);
  const initials =
    player.name
      ?.split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("") || "?";
  const dims = size === "lg" ? "h-12 w-12" : size === "md" ? "h-9 w-9" : "h-7 w-7";
  const textSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-[10px]";

  return (
    <div className="relative shrink-0">
      <div
        className={`${dims} rounded-full overflow-hidden flex items-center justify-center bg-muted ${
          player.isCaptain
            ? "ring-2 ring-gold"
            : player.isViceCaptain
              ? "ring-2 ring-primary"
              : player.inMyXI
                ? "ring-2 ring-primary/40"
                : "ring-1 ring-border"
        }`}
      >
        {player.imageId && !imgErr ? (
          <img
            src={playerImageUrl(Number(player.imageId))}
            alt={player.name}
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className={`${textSize} font-bold`}>{initials}</span>
        )}
      </div>
    </div>
  );
}

function TopPerformerCard({ player }: { player: PlayerStat }) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Top Performer
          </span>
        </div>
        <div className="flex items-center gap-3">
          <PlayerAvatar player={player} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold truncate">{player.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {player.team}
              </span>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                {player.role}
              </Badge>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold tabular-nums text-primary">
              {player.points.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">pts</p>
          </div>
        </div>
        {player.inMyXI ? (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-primary">
            <Star className="h-3 w-3 fill-primary" />
            <span className="font-medium">In your XI</span>
            {player.isCaptain && (
              <Badge variant="gold" className="text-[9px] h-4 ml-1">
                <Crown className="h-2.5 w-2.5 mr-0.5" />
                Captain
              </Badge>
            )}
            {player.isViceCaptain && (
              <Badge variant="default" className="text-[9px] h-4 ml-1">
                <Shield className="h-2.5 w-2.5 mr-0.5" />
                Vice Captain
              </Badge>
            )}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <span>Not in your XI</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MyXISummary({
  stats,
  hasTeam,
}: {
  stats: PlayerStat[];
  hasTeam: boolean;
}) {
  if (!hasTeam) return null;
  const myPlayers = stats.filter((s) => s.inMyXI);
  const totalPts = myPlayers.reduce((s, p) => s + p.points, 0);
  const captain = myPlayers.find((p) => p.isCaptain);
  const vc = myPlayers.find((p) => p.isViceCaptain);

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-1.5 mb-3">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            My XI Summary
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-lg font-bold tabular-nums">{myPlayers.length}</p>
            <p className="text-[10px] text-muted-foreground">Players</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-primary">
              {totalPts.toFixed(1)}
            </p>
            <p className="text-[10px] text-muted-foreground">Total Pts</p>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 rounded-full bg-gold text-[8px] font-extrabold flex items-center justify-center text-black shrink-0">
                C
              </div>
              <p className="text-sm font-semibold truncate">
                {captain?.name ?? "—"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {captain ? `${captain.points.toFixed(1)} pts` : "—"}
            </p>
          </div>
          <div>
            <div className="flex items-center gap-1">
              <div className="h-4 w-4 rounded-full bg-primary text-[8px] font-extrabold flex items-center justify-center text-primary-foreground shrink-0">
                VC
              </div>
              <p className="text-sm font-semibold truncate">
                {vc?.name ?? "—"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {vc ? `${vc.points.toFixed(1)} pts` : "—"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerRow({ player, rank, showMedals, onClick }: { player: PlayerStat; rank: number; showMedals: boolean; onClick?: () => void }) {
  const isTopScorer = showMedals && rank <= 3 && player.points > 0;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
        player.inMyXI
          ? "bg-primary/[0.06] border border-primary/15 hover:bg-primary/[0.1]"
          : isTopScorer
            ? "bg-primary/5 border border-primary/10 hover:bg-primary/[0.08]"
            : "bg-muted/30 hover:bg-muted/50"
      }`}
    >
      {/* Rank */}
      <span
        className={`w-6 text-center text-sm tabular-nums font-semibold shrink-0 ${
          rank === 1
            ? "text-gold"
            : rank === 2
              ? "text-muted-foreground"
              : rank === 3
                ? "text-muted-foreground"
                : "text-muted-foreground/60"
        }`}
      >
        {showMedals && rank <= 3 && player.points > 0
          ? ["🥇", "🥈", "🥉"][rank - 1]
          : rank}
      </span>

      {/* Avatar */}
      <PlayerAvatar player={player} size="sm" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium truncate">{player.name}</span>
          {player.isCaptain && (
            <div className="h-4 w-4 rounded-full bg-gold text-[7px] font-extrabold flex items-center justify-center text-black shrink-0">
              C
            </div>
          )}
          {player.isViceCaptain && (
            <div className="h-4 w-4 rounded-full bg-primary text-[7px] font-extrabold flex items-center justify-center text-primary-foreground shrink-0">
              VC
            </div>
          )}
          {player.inMyXI && !player.isCaptain && !player.isViceCaptain && (
            <Star className="h-3 w-3 text-primary/60 fill-primary/60 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{player.team}</span>
          <span className="text-[10px] text-muted-foreground/40">·</span>
          <span className="text-[10px] text-muted-foreground">{player.role}</span>
          {/* Inline batting/bowling stats */}
          {player.batting && (
            <>
              <span className="text-[10px] text-muted-foreground/40">·</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {player.batting.runs}({player.batting.balls})
              </span>
            </>
          )}
          {player.bowling && player.bowling.overs > 0 && (
            <>
              <span className="text-[10px] text-muted-foreground/40">·</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {player.bowling.wickets}/{player.bowling.runs}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <span
          className={`text-sm tabular-nums font-semibold ${
            isTopScorer
              ? "text-primary font-bold"
              : player.points > 0
                ? ""
                : "text-muted-foreground"
          }`}
        >
          {player.points > 0 ? player.points.toFixed(1) : "—"}
        </span>
      </div>

      {/* Tap indicator */}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
    </div>
  );
}

/* ── Selected-By Types & Drawer ──────────────────────── */

type SelectedByUser = {
  name: string;
  email: string;
  totalpoints: number;
  asCaptain: boolean;
  asViceCaptain: boolean;
};

/** Build a map: playerId → list of users who picked that player */
function buildSelectedByMap(
  lbRows: MatchLeaderboardEntry[],
): Map<string, SelectedByUser[]> {
  const map = new Map<string, SelectedByUser[]>();
  for (const row of lbRows) {
    for (const p of row.playerEntities ?? []) {
      let list = map.get(p.playerid);
      if (!list) {
        list = [];
        map.set(p.playerid, list);
      }
      list.push({
        name: row.name || row.email,
        email: row.email,
        totalpoints: row.totalpoints,
        asCaptain: p.playerid === row.captain,
        asViceCaptain: p.playerid === row.vcaptain,
      });
    }
  }
  // Sort each list by total points descending
  for (const list of map.values()) {
    list.sort((a, b) => b.totalpoints - a.totalpoints);
  }
  return map;
}

function SelectedByContent({
  player,
  users,
  totalUsers,
}: {
  player: PlayerStat;
  users: SelectedByUser[];
  totalUsers: number;
}) {
  const pct = totalUsers > 0 ? Math.round((users.length / totalUsers) * 100) : 0;
  const captains = users.filter((u) => u.asCaptain);
  const viceCaptains = users.filter((u) => u.asViceCaptain);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-4 pt-5 shrink-0">
        <p className="text-[11px] text-muted-foreground tracking-wide uppercase mb-3">
          Player · {player.role}
        </p>

        {/* Player identity */}
        <div className="flex items-center gap-3 mb-4">
          <PlayerAvatar player={player} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold truncate leading-tight">{player.name}</p>
            <p className="text-[11px] text-muted-foreground">{player.team}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
              {player.points.toFixed(1)}
            </span>
            <p className="text-[10px] text-muted-foreground mt-0.5">pts</p>
          </div>
        </div>

        {/* Captain / VC chips */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 bg-gold/5 border-gold/20">
            <div className="h-6 w-6 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 bg-gold text-black">
              C
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium tabular-nums">{captains.length}</p>
              <p className="text-[10px] text-gold/60">as captain</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 bg-primary/5 border-primary/20">
            <div className="h-6 w-6 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 bg-primary text-primary-foreground">
              VC
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium tabular-nums">{viceCaptains.length}</p>
              <p className="text-[10px] text-primary/60">as vice-captain</p>
            </div>
          </div>
        </div>

        {/* Selection bar */}
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">{users.length}</span>
          <span className="text-xs text-muted-foreground">of {totalUsers}</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums">{pct}%</span>
        </div>
      </div>

      <Separator className="shrink-0" />

      {/* User list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Selected by
        </p>
        {users.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No one selected this player
          </div>
        ) : (
          <div>
            {users.map((u) => (
              <div key={u.email} className="flex items-center gap-3 py-2">
                {/* User avatar */}
                <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  u.asCaptain
                    ? "ring-2 ring-gold bg-gold/10 text-gold"
                    : u.asViceCaptain
                      ? "ring-2 ring-primary bg-primary/10 text-primary"
                      : "ring-1 ring-border bg-muted text-muted-foreground"
                }`}>
                  {u.name.charAt(0).toUpperCase()}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  {!u.asCaptain && !u.asViceCaptain && (
                    <p className="text-[10px] text-muted-foreground">Player</p>
                  )}
                  {u.asCaptain && (
                    <p className="text-[10px] text-gold/60">Captain · 2x pts</p>
                  )}
                  {u.asViceCaptain && (
                    <p className="text-[10px] text-primary/60">Vice-captain · 1.5x pts</p>
                  )}
                </div>

                {/* Points */}
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {u.totalpoints.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground">
          {users.length} users
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Selection details
        </div>
      </div>
    </div>
  );
}

function SelectedByDrawer({
  open,
  onClose,
  player,
  users,
  totalUsers,
}: {
  open: boolean;
  onClose: () => void;
  player: PlayerStat | null;
  users: SelectedByUser[];
  totalUsers: number;
}) {
  const [dragY, setDragY] = useState(0);
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const dragYRef = useRef(0);
  const startedInScrollArea = useRef(false);
  const scrolledDuringTouch = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Track sm breakpoint to avoid rendering both Sheet and mobile drawer
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Animate in/out
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setEntered(true));
      });
    } else if (visible) {
      setEntered(false);
      const timer = setTimeout(() => setVisible(false), 420);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [visible]);

  // Touch drag-to-dismiss
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const scrollEl = scrollRef.current;
      const inScrollArea = scrollEl?.contains(e.target as Node);
      startedInScrollArea.current = !!inScrollArea;
      scrolledDuringTouch.current = false;
      dragStartY.current = e.touches[0].clientY;
      isDragging.current = !inScrollArea;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startedInScrollArea.current && !isDragging.current) {
        const scrollEl = scrollRef.current;
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
        e.preventDefault();
        dragYRef.current = delta;
        setDragY(delta);
      }
    };

    const onTouchEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      if (dragYRef.current > 120) onClose();
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
  }, [visible, onClose]);

  // Stop non-passive parent touchmove from blocking native scroll in the scroll area
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const onScrollTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) e.stopPropagation();
    };

    scrollEl.addEventListener("touchmove", onScrollTouchMove, { passive: true });
    return () => scrollEl.removeEventListener("touchmove", onScrollTouchMove);
  }, [visible]);

  if (!player) return null;

  return (
    <>
      {/* Desktop: side sheet */}
      {isDesktop && (
        <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
          <SheetContent side="right" className="p-0 flex flex-col overflow-hidden sm:max-w-md">
            <SheetTitle className="sr-only">Player Details</SheetTitle>
            <SelectedByContent player={player} users={users} totalUsers={totalUsers} />
          </SheetContent>
        </Sheet>
      )}

      {/* Mobile: bottom drawer */}
      {!isDesktop && visible && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50"
            style={{ opacity: entered ? 1 : 0, transition: "opacity 300ms ease" }}
            onClick={onClose}
          />
          <div
            ref={sheetRef}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col h-[92vh] rounded-t-3xl overflow-hidden bg-background"
            style={{
              boxShadow: "0 -6px 20px rgba(255, 255, 255, 0.08), 0 -1px 6px rgba(255, 255, 255, 0.05)",
              transform: `translateY(${!entered ? "100%" : dragY > 0 ? `${dragY}px` : "0"})`,
              transition: dragY > 0 ? "none" : "transform 400ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <div className="absolute top-0 inset-x-0 z-20 flex justify-center py-3 rounded-t-3xl backdrop-blur-md" style={{ touchAction: "none" }}>
              <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
            </div>
            <div ref={scrollRef} className="overflow-y-auto flex-1 min-h-0 pt-2" style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
              <SelectedByContent player={player} users={users} totalUsers={totalUsers} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Main Tab Component ───────────────────────────────── */

export type PlayerStatsTabProps = {
  lbRows: MatchLeaderboardEntry[];
  lbLoading: boolean;
  lbError: string | null;
  matchPlayers: ApiPlayer[];
  dreamTeam: any | null;
  innings1: ScorecardInnings | null;
  innings2: ScorecardInnings | null;
  isLive?: boolean;
  match: ApiMatch | null;
};

export default function PlayerStatsTab({
  lbRows,
  lbLoading,
  lbError,
  matchPlayers,
  dreamTeam,
  innings1,
  innings2,
  isLive = false,
  match,
}: PlayerStatsTabProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [myXIOnly, setMyXIOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("points-desc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const hasTeam = dreamTeam != null;
  const matchStarted = isLive || match?.state === "Completed";

  // Build normalized player stats
  const allStats = useMemo(
    () => buildPlayerStats(lbRows, matchPlayers, dreamTeam, innings1, innings2, match),
    [lbRows, matchPlayers, dreamTeam, innings1, innings2, match],
  );

  // Available teams for filter
  const teams = useMemo(() => {
    const s = new Set<string>();
    for (const p of allStats) if (p.team) s.add(p.team);
    return Array.from(s).sort();
  }, [allStats]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = allStats;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (roleFilter !== "ALL") list = list.filter((p) => p.role === roleFilter);
    if (teamFilter !== "ALL") list = list.filter((p) => p.team === teamFilter);
    if (myXIOnly) list = list.filter((p) => p.inMyXI);

    const sorted = [...list];
    switch (sortKey) {
      case "points-desc":
        sorted.sort((a, b) => b.points - a.points);
        break;
      case "points-asc":
        sorted.sort((a, b) => a.points - b.points);
        break;
      case "name-asc":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [allStats, search, roleFilter, teamFilter, myXIOnly, sortKey]);

  // Ranks (competition-style)
  const ranks = useMemo(() => {
    const r: number[] = [];
    for (let i = 0; i < filtered.length; i++) {
      if (i === 0 || filtered[i].points !== filtered[i - 1].points) {
        r.push(i + 1);
      } else {
        r.push(r[i - 1]);
      }
    }
    return r;
  }, [filtered]);

  const topPerformer = useMemo(() => {
    if (allStats.length === 0) return null;
    const sorted = [...allStats].sort((a, b) => b.points - a.points);
    return sorted[0].points > 0 ? sorted[0] : null;
  }, [allStats]);

  // Build selected-by map from leaderboard data
  const selectedByMap = useMemo(() => buildSelectedByMap(lbRows), [lbRows]);
  const selectedPlayer = selectedPlayerId
    ? allStats.find((p) => p.playerId === selectedPlayerId) ?? null
    : null;
  const selectedByUsers = selectedPlayerId
    ? selectedByMap.get(selectedPlayerId) ?? []
    : [];

  const hasPoints = allStats.some((p) => p.points > 0);

  // ── Loading ──
  if (lbLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-16 rounded-md" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // ── Error ──
  if (lbError) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex items-center gap-3 pt-6 text-destructive">
          <span className="text-sm">{lbError}</span>
        </CardContent>
      </Card>
    );
  }

  // ── Empty / pre-match ──
  if (allStats.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground font-medium">
          Player fantasy points will appear here once the match starts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      {isLive && (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-xs font-medium text-primary">Live updating</span>
        </div>
      )}

      {/* Top Performer */}
      {topPerformer && <TopPerformerCard player={topPerformer} />}

      {/* My XI Summary */}
      {hasTeam && <MyXISummary stats={allStats} hasTeam={hasTeam} />}

      {/* Controls */}
      <div className="space-y-3 sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 -mx-1 px-1 pt-1">
        {/* Search + Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-search=""
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="pl-9"
            />
          </div>
          <Select
            value={sortKey}
            onValueChange={(v) => setSortKey(v as SortKey)}
          >
            <SelectTrigger className="w-[140px] shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="points-desc">Highest Pts</SelectItem>
              <SelectItem value="points-asc">Lowest Pts</SelectItem>
              <SelectItem value="name-asc">A → Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5" data-tour="playerstats-filters">
          {/* Role filters */}
          {(Object.keys(ROLE_LABELS) as RoleFilter[]).map((role) => (
            <Button
              key={role}
              variant={roleFilter === role ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setRoleFilter(role)}
            >
              {ROLE_LABELS[role]}
            </Button>
          ))}

          <span className="w-px h-7 bg-border" />

          {/* Team filter */}
          {teams.length === 2 && teams.map((t) => (
            <Button
              key={t}
              variant={teamFilter === t ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() =>
                setTeamFilter(teamFilter === t ? "ALL" : t)
              }
            >
              {t}
            </Button>
          ))}
          {teams.length > 2 && (
            <Select
              value={teamFilter}
              onValueChange={setTeamFilter}
            >
              <SelectTrigger className="h-7 text-xs w-auto px-2.5">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* My XI toggle */}
          {hasTeam && (
            <>
              <span className="w-px h-7 bg-border" />
              <Button
                variant={myXIOnly ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setMyXIOnly(!myXIOnly)}
              >
                <Star
                  className={`h-3 w-3 mr-1 ${myXIOnly ? "fill-current" : ""}`}
                />
                My XI
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Player list header */}
      <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        <span className="w-6 text-center">#</span>
        <span className="w-7" />
        <span className="flex-1">Player</span>
        <span className="text-right w-12">Pts</span>
      </div>

      {/* Player rows */}
      <div className="space-y-1">
        {filtered.map((p, i) => (
          <PlayerRow
            key={p.playerId}
            player={p}
            rank={sortKey === "points-desc" ? ranks[i] : i + 1}
            showMedals={sortKey === "points-desc"}
            onClick={matchStarted ? () => setSelectedPlayerId(p.playerId) : undefined}
          />
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {!hasPoints
              ? "Fantasy points will appear here once the match starts."
              : "No players match your filters."}
          </div>
        )}
      </div>

      {/* Footer count */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        {filtered.length} of {allStats.length} players
      </p>

      {/* Selected-by drawer */}
      {matchStarted && (
        <SelectedByDrawer
          open={selectedPlayerId != null}
          onClose={() => setSelectedPlayerId(null)}
          player={selectedPlayer}
          users={selectedByUsers}
          totalUsers={lbRows.length}
        />
      )}
    </div>
  );
}
