import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { driver, type DriveStep, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import {
  type TourDef,
  getUnseenTours,
  getNextAutoTour,
  markTourSeen,
  setSessionTourFired,
} from './tours'

// ── Context ──

export type TourContextValue = {
  /** Start a specific tour by its definition */
  startTour: (tour: TourDef) => void
  /** Currently running tour ID, or null */
  activeTourId: string | null
  /** Number of unseen tours (for badge counts) */
  unseenCount: number
  /** Refresh the unseen count (after marking seen) */
  refreshUnseen: () => void
  /** Is the What's New modal open? */
  whatsNewOpen: boolean
  setWhatsNewOpen: (v: boolean) => void
}

export const TourContext = createContext<TourContextValue | null>(null)

// ── Helpers ──

/** Wait for a selector to appear in DOM. Resolves true if found, false on timeout. */
function waitForSelector(sel: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(sel)) return resolve(true)
    const interval = 100
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += interval
      if (document.querySelector(sel)) {
        clearInterval(timer)
        resolve(true)
      } else if (elapsed >= timeoutMs) {
        clearInterval(timer)
        resolve(false)
      }
    }, interval)
  })
}

// ── Provider ──

const AUTO_START_DELAY = 1500

export function TourProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const driverRef = useRef<Driver | null>(null)

  const [activeTourId, setActiveTourId] = useState<string | null>(null)
  const [unseenCount, setUnseenCount] = useState(0)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)

  const refreshUnseen = useCallback(() => {
    setUnseenCount(getUnseenTours().length)
  }, [])

  // Compute initial unseen count
  useEffect(() => {
    refreshUnseen()
  }, [refreshUnseen])

  // Build driver steps, executing route navigation + selector waits
  const startTour = useCallback(
    async (tour: TourDef) => {
      // Close What's New if open
      setWhatsNewOpen(false)

      // Destroy any existing driver
      if (driverRef.current) {
        driverRef.current.destroy()
        driverRef.current = null
      }

      setActiveTourId(tour.id)

      // Pre-process: navigate + wait for each step, collect valid driver steps
      const validSteps: DriveStep[] = []

      for (const step of tour.steps) {
        // Navigate if needed
        if (step.route && location.pathname !== step.route) {
          navigate(step.route)
          // Small delay for route transition
          await new Promise((r) => setTimeout(r, 300))
        }

        const found = await waitForSelector(step.selector)
        if (!found) continue // skip missing targets gracefully

        validSteps.push({
          element: step.selector,
          popover: {
            title: step.title,
            description: step.description,
            side: step.side ?? 'bottom',
          },
        })
      }

      if (validSteps.length === 0) {
        // All steps missing — mark seen and bail
        markTourSeen(tour.id)
        setActiveTourId(null)
        refreshUnseen()
        return
      }

      const d = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayColor: 'black',
        overlayOpacity: 0.6,
        stagePadding: 8,
        stageRadius: 10,
        popoverClass: 'fantasyf-tour-popover',
        steps: validSteps,
        onDestroyStarted: () => {
          d.destroy()
        },
        onDestroyed: () => {
          markTourSeen(tour.id)
          setActiveTourId(null)
          driverRef.current = null
          refreshUnseen()
        },
      })

      driverRef.current = d
      d.drive()
    },
    [navigate, location.pathname, refreshUnseen],
  )

  // Auto-start oldest unseen tour after delay (once per session)
  useEffect(() => {
    const timer = setTimeout(() => {
      const tour = getNextAutoTour()
      if (tour) {
        setSessionTourFired()
        startTour(tour)
      }
    }, AUTO_START_DELAY)
    return () => clearTimeout(timer)
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TourContext.Provider
      value={{
        startTour,
        activeTourId,
        unseenCount,
        refreshUnseen,
        whatsNewOpen,
        setWhatsNewOpen,
      }}
    >
      {children}
    </TourContext.Provider>
  )
}
