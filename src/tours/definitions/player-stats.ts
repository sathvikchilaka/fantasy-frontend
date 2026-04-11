import { BarChart3 } from 'lucide-react'
import type { TourDef } from '../tours'

export const playerStatsTour: TourDef = {
  id: 'player-stats-v1',
  title: 'Player Stats',
  description:
    'Dive deep into player performance — filter by role, team, or just your XI.',
  icon: BarChart3,
  showAfter: '2026-04-17',
  steps: [
    {
      selector: '[data-tour="matchdetail-playerstats-tab"]',
      title: 'Player Stats Tab',
      description:
        'Head to the Player Stats tab on any match to see detailed per-player breakdowns.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="playerstats-filters"]',
      title: 'Filter Players',
      description:
        'Filter by role (WK, BAT, AR, BW), by team, or toggle "My XI" to see only your selected players.',
      side: 'bottom',
    },
  ],
}
