import { FlaskConical } from 'lucide-react'
import type { TourDef } from '../tours'

export const preferencesAutoselectTour: TourDef = {
  id: 'preferences-autoselect-v1',
  title: 'Auto-Select Preference',
  description:
    'Never miss a match — enable auto-select and we\'ll pick a Smart XI for you.',
  icon: FlaskConical,
  showAfter: '2026-04-15',
  steps: [
    {
      selector: '[data-tour="profile-preferences"]',
      route: '/profile',
      title: 'Preferences',
      description:
        'Your preferences live here in your profile. Let\'s look at auto-select.',
      side: 'top',
    },
    {
      selector: '[data-tour="profile-autoteam-switch"]',
      route: '/profile',
      title: 'Auto-Select Smart XI',
      description:
        'Toggle this on and if you forget to pick your squad before a match, we\'ll auto-pick a balanced Smart XI so you never miss out on points.',
      side: 'top',
    },
  ],
}
