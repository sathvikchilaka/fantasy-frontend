import type { ApiPlayer } from '@/types/api'
import { playerKey } from '@/fantasy/dream11Rules'
import { Button } from '@/components/ui/button'
import { CaptainCard } from '../components/CaptainCard'
import { StatusBanner } from '../components/StatusBanner'
import { Loader2, Check } from 'lucide-react'

interface Step2Props {
  selectedList: ApiPlayer[]
  captainId: string | null
  viceCaptainId: string | null
  captainViceErrors: string[]
  onAssign: (key: string) => void
  onSave: () => void
  canSave: boolean
  saving: boolean
  success: boolean
}

export function Step2CaptainPicker({
  selectedList, captainId, viceCaptainId, captainViceErrors,
  onAssign, onSave, canSave, saving, success,
}: Step2Props) {
  const hasCaptain = captainId !== null
  const hasVC = viceCaptainId !== null

  return (
    <div className="flex flex-col h-full">
      {/* Status */}
      <StatusBanner
        apiError={null}
        hint={null}
        validationError={null}
        captainViceError={captainViceErrors.length > 0 ? captainViceErrors[0] : null}
      />

      {/* Instruction */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <p className="text-sm text-muted-foreground">
          {!hasCaptain
            ? 'Tap a player to make them Captain (2x points)'
            : !hasVC
            ? 'Now tap another player for Vice-Captain (1.5x points)'
            : 'Looking good! Tap to change selections.'}
        </p>
      </div>

      {/* Player cards */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 space-y-2.5">
        {selectedList.map((p) => {
          const pk = playerKey(p)
          return (
            <CaptainCard
              key={pk}
              player={p}
              isCaptain={captainId === pk}
              isViceCaptain={viceCaptainId === pk}
              onClick={() => onAssign(pk)}
            />
          )
        })}
      </div>

      {/* Save CTA */}
      <div className="shrink-0 border-t bg-background/95 backdrop-blur-sm px-4 py-3">
        <Button
          disabled={!canSave || saving || success}
          onClick={onSave}
          className="w-full h-12 rounded-xl text-sm font-semibold gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4" /> : null}
          {saving ? 'Saving...' : success ? 'Saved!' : 'Save Squad'}
        </Button>
      </div>
    </div>
  )
}
