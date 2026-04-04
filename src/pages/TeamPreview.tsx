// @ts-nocheck
import { useState, useEffect } from "react";
import { apiUrl, getToken, playerImageUrl } from "../api/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AlertCircle } from "lucide-react";

const ROLE_ORDER = ["WK", "BAT", "AR", "BOWL"];
const ROLE_LABELS = { WK: "Wicket Keeper", BAT: "Batsmen", AR: "All Rounders", BOWL: "Bowlers" };

function assignRole(index) {
  if (index === 0) return "WK";
  if (index < 4) return "BAT";
  if (index < 7) return "AR";
  return "BOWL";
}

function groupByRole(players, captainId, vcId) {
  const groups = { WK: [], BAT: [], AR: [], BOWL: [] };
  players.forEach((p, i) => {
    const role = p.type || assignRole(i);
    groups[role]?.push({
      ...p,
      isCaptain: p.playerid === captainId,
      isViceCaptain: p.playerid === vcId,
    });
  });
  return groups;
}

function PlayerRow({ player }) {
  const [imgErr, setImgErr] = useState(false);
  const initials = player.name?.split(" ").map((w) => w[0]).slice(0, 2).join("") || "?";

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div
          className={`h-9 w-9 rounded-full overflow-hidden flex items-center justify-center bg-muted ${
            player.isCaptain
              ? "ring-2 ring-gold"
              : player.isViceCaptain
              ? "ring-2 ring-primary"
              : "ring-1 ring-border"
          }`}
        >
          {player.url && !imgErr ? (
            <img
              src={playerImageUrl(player.url)}
              alt={player.name}
              onError={() => setImgErr(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold">{initials}</span>
          )}
        </div>
        {(player.isCaptain || player.isViceCaptain) && (
          <div
            className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-[8px] font-extrabold flex items-center justify-center ${
              player.isCaptain ? "bg-gold text-black" : "bg-primary text-primary-foreground"
            }`}
          >
            {player.isCaptain ? "C" : "VC"}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{player.name}</p>
        {player.team && (
          <p className="text-[11px] text-muted-foreground">{player.team}</p>
        )}
      </div>

      {/* Points */}
      <span className="text-sm font-semibold tabular-nums shrink-0">
        {player.points != null ? player.points.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function RoleGroup({ role, players }) {
  if (!players?.length) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {ROLE_LABELS[role]}
        </span>
        <Badge variant="secondary" className="text-[9px] h-4 px-1">
          {players.length}
        </Badge>
      </div>
      <div>
        {players.map((p) => (
          <PlayerRow key={p.playerid} player={p} />
        ))}
      </div>
    </div>
  );
}

export default function TeamPreview({ matchId, dreamId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = getToken();
    setLoading(true);
    setError(null);
    fetch(apiUrl(`dream/${matchId}/${dreamId}`), {
      method: "GET",
      headers: { key: token, "Content-Type": "application/json" },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [matchId, dreamId]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <Separator />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 py-20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">Failed to load team</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  const { captain, vcaptain, playerEntities = [] } = data;
  const groups = groupByRole(playerEntities, captain, vcaptain);
  const totalPoints = playerEntities.reduce((sum, p) => sum + (p.points ?? 0), 0);
  const cap = playerEntities.find((p) => p.playerid === captain);
  const vc = playerEntities.find((p) => p.playerid === vcaptain);

  const teamCounts = Object.values(
    playerEntities.reduce((acc, p) => {
      const name = p.team?.teamname;
      if (!name) return acc;
      acc[name] = acc[name] || { name, count: 0 };
      acc[name].count++;
      return acc;
    }, {})
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 pb-4 pt-5 shrink-0">
        <p className="text-[11px] text-muted-foreground tracking-wide uppercase mb-3">
          Squad · {playerEntities.length} players
        </p>

        {/* Points badge */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
            {totalPoints.toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">pts</span>
        </div>

        {/* Captain / VC chips */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "C", player: cap, accent: "gold", mult: "2x" },
            { label: "VC", player: vc, accent: "primary", mult: "1.5x" },
          ].map(({ label, player, accent, mult }) => (
            <div
              key={label}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${
                accent === "gold"
                  ? "bg-gold/5 border-gold/20"
                  : "bg-primary/5 border-primary/20"
              }`}
            >
              <div
                className={`h-6 w-6 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                  accent === "gold" ? "bg-gold text-black" : "bg-primary text-primary-foreground"
                }`}
              >
                {label}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {player?.name ?? "—"}
                </p>
                <p className={`text-[10px] ${accent === "gold" ? "text-gold/60" : "text-primary/60"}`}>
                  {mult} points
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Team composition bar */}
        {teamCounts.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {teamCounts.map((t, i) => (
              <span
                key={t.name}
                className={`text-xs font-semibold ${i === 0 ? "text-blue-400" : "text-gold"}`}
              >
                {t.name} {t.count}
              </span>
            ))}
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-400"
                style={{
                  width: `${(teamCounts[0]?.count / playerEntities.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <Separator className="shrink-0" />

      {/* Player list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4 space-y-5">
        {ROLE_ORDER.map((role) => (
          <RoleGroup key={role} role={role} players={groups[role]} />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t px-6 py-3 flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground">
          {playerEntities.length} players
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Preview only
        </div>
      </div>
    </div>
  );
}
