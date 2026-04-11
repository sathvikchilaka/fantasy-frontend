import type { ComponentType } from 'react'

// ── Types ──

export type TourStep = {
  /** CSS selector — prefer data-tour="xxx" attributes */
  selector: string
  /** Navigate to this route before showing this step */
  route?: string
  title: string
  description: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export type TourDef = {
  /** Unique ID. Bump version suffix to re-show (e.g. 'feat-v1' → 'feat-v2') */
  id: string
  title: string
  /** One-liner shown in What's New modal */
  description: string
  /** Lucide icon component for What's New card */
  icon?: ComponentType<{ className?: string }>
  /**
   * ISO date string (YYYY-MM-DD). Tour becomes eligible after this date.
   * Use this to stagger multiple feature tours over days/weeks.
   */
  showAfter: string
  steps: TourStep[]
}

// ── Registry ──

const registry: TourDef[] = []

export function registerTour(tour: TourDef) {
  if (!registry.some((t) => t.id === tour.id)) registry.push(tour)
}

export function getAllTours(): TourDef[] {
  return registry
}

// ── localStorage helpers ──

const SEEN_KEY = 'fantasyf-tours-seen'
const SESSION_KEY = 'fantasyf-tours-session'

export function getSeenTourIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

export function markTourSeen(id: string) {
  const seen = getSeenTourIds()
  seen.add(id)
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
}

/** Returns true if an auto-tour already fired this session */
export function hasSessionTourFired(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1'
}

export function setSessionTourFired() {
  sessionStorage.setItem(SESSION_KEY, '1')
}

// ── Eligibility ──

/** Tours that are eligible (date passed) and not yet seen */
export function getUnseenTours(): TourDef[] {
  const seen = getSeenTourIds()
  const now = Date.now()
  return getAllTours()
    .filter((t) => new Date(t.showAfter).getTime() <= now && !seen.has(t.id))
    .sort((a, b) => new Date(a.showAfter).getTime() - new Date(b.showAfter).getTime())
}

/** Oldest unseen tour eligible for auto-start */
export function getNextAutoTour(): TourDef | null {
  if (hasSessionTourFired()) return null
  const unseen = getUnseenTours()
  return unseen[0] ?? null
}
