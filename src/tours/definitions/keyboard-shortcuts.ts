import { Keyboard } from 'lucide-react'
import type { TourDef } from '../tours'

export const keyboardShortcutsTour: TourDef = {
  id: 'keyboard-shortcuts-v1',
  title: 'Keyboard Shortcuts',
  description:
    'Navigate faster with keyboard shortcuts — press ? anywhere to see them all.',
  icon: Keyboard,
  showAfter: '2026-04-11',
  steps: [
    {
      selector: '[data-tour="nav-bar"]',
      title: 'Quick Navigation',
      description:
        'Press G then H, M, or P to jump between Home, Matches, and Profile instantly.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="whats-new-btn"]',
      title: "What's New",
      description:
        "This sparkle icon shows you new features. Click it anytime to see what's been added!",
      side: 'bottom',
    },
  ],
}
