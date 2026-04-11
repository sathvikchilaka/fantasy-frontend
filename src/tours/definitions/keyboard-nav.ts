import { Keyboard } from 'lucide-react'
import type { TourDef } from '../tours'

export const keyboardNavTour: TourDef = {
  id: 'keyboard-nav-v1',
  title: 'Keyboard Navigation',
  description:
    'Web users: navigate the entire app with keyboard shortcuts — no mouse needed.',
  icon: Keyboard,
  showAfter: '2026-04-11',
  steps: [
    {
      selector: '[data-tour="nav-bar"]',
      title: 'Jump Between Pages',
      description:
        'Press G then H (Home), M (Matches), or P (Profile) to navigate instantly. This is a web-only feature — keyboard shortcuts work on desktop browsers.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="nav-bar"]',
      title: 'More Shortcuts',
      description:
        'Press ? anywhere to see all available shortcuts. Use number keys 1-3 to switch tabs on match pages, arrow keys on the leaderboard, and more.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="whats-new-btn"]',
      title: 'Desktop Power Feature',
      description:
        'Keyboard shortcuts are designed for web/desktop users. On mobile, just tap as usual!',
      side: 'bottom',
    },
  ],
}
