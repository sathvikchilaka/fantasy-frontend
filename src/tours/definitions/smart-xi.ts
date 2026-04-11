import { Sparkles } from 'lucide-react'
import type { TourDef } from '../tours'

export const smartXITour: TourDef = {
  id: 'smart-xi-v1',
  title: 'Smart XI',
  description:
    'Let us auto-pick a balanced XI based on credits, roles, and team diversity.',
  icon: Sparkles,
  showAfter: '2026-04-19',
  steps: [
    {
      selector: '[data-tour="createteam-smart-xi"]',
      title: 'Smart XI',
      description:
        'Tap "Smart XI" (or press S) to auto-pick a balanced squad. It considers player credits, role balance, and team diversity to build a competitive lineup.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="createteam-save"]',
      title: 'Review & Save',
      description:
        'After Smart XI picks your squad, review the selections and hit Save. You can still swap players before saving.',
      side: 'bottom',
    },
  ],
}
