import { Check } from 'lucide-react'
import { playerImageUrl } from '@/api/client'
import { creditsForPlayer, normalizeRole } from '@/fantasy/dream11Rules'
import type { ApiPlayer } from '@/types/api'

interface PlayerPoolCardProps {
  player: ApiPlayer
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}

export function PlayerPoolCard({ player, isSelected, isDisabled, onClick }: PlayerPoolCardProps) {
  const cr = creditsForPlayer(player)
  const role = normalizeRole(player.type)

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`flex items-center gap-3 w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'border-primary/50 bg-primary/5 shadow-sm'
          : isDisabled
          ? 'opacity-30 cursor-not-allowed'
          : 'border-transparent bg-muted/40 hover:bg-muted/70 active:scale-[0.98]'
      }`}
    >
      <img
        className="h-10 w-10 rounded-full object-cover bg-muted shrink-0"
        src={playerImageUrl(player.imageId)}
        alt=""
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{player.name}</p>
        <p className="text-[11px] text-muted-foreground">{role}</p>
      </div>
      <span className="text-sm font-semibold tabular-nums shrink-0 text-muted-foreground">{cr.toFixed(1)}</span>
      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
    </button>
  )
}
