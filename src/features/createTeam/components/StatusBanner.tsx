import { AlertCircle } from 'lucide-react'

interface StatusBannerProps {
  apiError: string | null
  hint: string | null
  validationError: string | null
  captainViceError: string | null
}

export function StatusBanner({ apiError, hint, validationError, captainViceError }: StatusBannerProps) {
  if (apiError) return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{apiError}</span>
    </div>
  )
  if (hint) return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gold/8 border-b border-gold/15 text-gold text-xs">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{hint}</span>
    </div>
  )
  if (validationError) return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{validationError}</span>
    </div>
  )
  if (captainViceError) return (
    <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-violet-500/8 border-b border-violet-500/15 text-violet-400 text-xs">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{captainViceError}</span>
    </div>
  )
  return null
}
