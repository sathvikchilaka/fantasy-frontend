import { playerImageUrl } from '@/api/client'
import { normalizeRole } from '@/fantasy/dream11Rules'
import type { ApiPlayer } from '@/types/api'

interface CaptainCardProps {
  player: ApiPlayer
  isCaptain: boolean
  isViceCaptain: boolean
  onClick: () => void
}

export function CaptainCard({ player, isCaptain, isViceCaptain, onClick }: CaptainCardProps) {
  const role = normalizeRole(player.type)
  const assigned = isCaptain || isViceCaptain

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={assigned}
      className={`relative flex items-center gap-3.5 w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer active:scale-[0.97] ${
        isCaptain
          ? 'border-blue-500 bg-blue-500/8 shadow-md shadow-blue-500/10'
          : isViceCaptain
          ? 'border-violet-500 bg-violet-500/8 shadow-md shadow-violet-500/10'
          : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
      }`}
    >
      {/* Avatar with ring */}
      <div className="relative shrink-0">
        <div
          className={`h-14 w-14 rounded-full overflow-hidden bg-muted ${
            isCaptain ? 'ring-[3px] ring-blue-500' : isViceCaptain ? 'ring-[3px] ring-violet-500' : 'ring-1 ring-border'
          }`}
        >
          <img
            src={playerImageUrl(player.imageId)}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Role badge overlay */}
        {assigned && (
          <span
            className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-sm ${
              isCaptain ? 'bg-blue-500 text-white' : 'bg-violet-500 text-white'
            }`}
          >
            {isCaptain ? 'C' : 'VC'}
          </span>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold truncate">{player.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{role} · {player.team?.teamSName ?? player.team?.teamName ?? ''}</p>
      </div>

      {/* Multiplier badge */}
      {assigned ? (
        <span
          className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${
            isCaptain
              ? 'bg-blue-500 text-white'
              : 'bg-violet-500 text-white'
          }`}
        >
          {isCaptain ? '2x' : '1.5x'}
        </span>
      ) : (
        <span className="shrink-0 px-2.5 py-1 rounded-full text-xs text-muted-foreground/50 border border-dashed border-border">
          Tap
        </span>
      )}
    </button>
  )
}
