import { GitCompareArrows } from 'lucide-react'
import type { TourDef } from '../tours'

export const leaderboardCompareTour: TourDef = {
  id: 'leaderboard-compare-v1',
  title: 'Compare Teams',
  description:
    'Tap any opponent on the match leaderboard to compare your squad head-to-head.',
  icon: GitCompareArrows,
  showAfter: '2026-04-13',
  steps: [
    {
      selector: '[data-tour="matchdetail-tabs"]',
      title: 'Match Tabs',
      description:
        'Each match has Scorecard, Leaderboard, and Player Stats tabs. Head to Leaderboard to compare.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="matchdetail-leaderboard-tab"]',
      title: 'Leaderboard Tab',
      description:
        'Tap Leaderboard to see everyone\'s scores. Then tap any row to open their squad.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="matchdetail-compare-toggle"]',
      title: 'Compare Toggle',
      description:
        'Switch between "Their Squad" and "Compare" to see a side-by-side breakdown of your picks vs theirs.',
      side: 'top',
    },
  ],
}
