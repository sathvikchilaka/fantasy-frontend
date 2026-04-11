import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useTour } from './useTour'
import { getUnseenTours } from './tours'

export function WhatsNewModal() {
  const { whatsNewOpen, setWhatsNewOpen, startTour } = useTour()
  const unseen = getUnseenTours()

  return (
    <Dialog open={whatsNewOpen} onOpenChange={setWhatsNewOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            What's New
          </DialogTitle>
          <DialogDescription>
            Recent features added to FantasyF
          </DialogDescription>
        </DialogHeader>

        {unseen.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            You're all caught up!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {unseen.map((tour) => {
              const Icon = tour.icon
              return (
                <div
                  key={tour.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3 transition-colors hover:bg-accent/40"
                >
                  {Icon && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
                      <Icon className="h-4 w-4 text-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {tour.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {tour.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0 text-xs"
                    onClick={() => startTour(tour)}
                  >
                    Show me
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
