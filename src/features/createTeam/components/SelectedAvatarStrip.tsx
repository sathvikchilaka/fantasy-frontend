import { X } from 'lucide-react'
import { playerImageUrl } from '@/api/client'
import { playerKey } from '@/fantasy/dream11Rules'
import type { ApiPlayer } from '@/types/api'

interface SelectedAvatarStripProps {
  selectedList: ApiPlayer[]
  captainId: string | null
  viceCaptainId: string | null
  onRemove: (key: string) => void
}

export function SelectedAvatarStrip({ selectedList, captainId, viceCaptainId, onRemove }: SelectedAvatarStripProps) {
  if (selectedList.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
      {selectedList.map((p) => {
        const pk = playerKey(p)
        const isCap = captainId === pk
        const isVc = viceCaptainId === pk

        return (
          <button
            key={pk}
            type="button"
            onClick={() => onRemove(pk)}
            className="relative shrink-0 group cursor-pointer"
            aria-label={`${p.name} — remove`}
          >
            <div
              className={`h-10 w-10 rounded-full overflow-hidden bg-muted ${
                isCap ? 'ring-2 ring-blue-500' : isVc ? 'ring-2 ring-violet-500' : 'ring-1 ring-border'
              }`}
            >
              <img
                src={playerImageUrl(p.imageId)}
                alt={p.name}
                className="w-full h-full object-cover"
              />
            </div>
            {/* C/VC badge */}
            {(isCap || isVc) && (
              <span
                className={`absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full text-[7px] font-bold flex items-center justify-center ${
                  isCap ? 'bg-blue-500 text-white' : 'bg-violet-500 text-white'
                }`}
              >
                {isCap ? 'C' : 'VC'}
              </span>
            )}
            {/* Remove overlay on tap */}
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity">
              <X className="h-3.5 w-3.5 text-white" />
            </div>
          </button>
        )
      })}
    </div>
  )
}
