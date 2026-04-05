import { ChevronLeft } from 'lucide-react'

interface StepIndicatorProps {
  step: 1 | 2
  onBack: () => void
  title: string
  subtitle: string
}

export function StepIndicator({ step, onBack, title, subtitle }: StepIndicatorProps) {
  return (
    <header className="shrink-0 border-b bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center h-9 w-9 -ml-1 rounded-full hover:bg-muted transition-colors cursor-pointer shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step ? 'w-6 bg-primary' : s < step ? 'w-4 bg-primary/40' : 'w-4 bg-muted'
              }`}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">{step}/2</span>
        </div>
      </div>
    </header>
  )
}
