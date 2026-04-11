import { registerTour } from '../tours'
import { keyboardNavTour } from './keyboard-nav'
import { leaderboardCompareTour } from './leaderboard-compare'
import { preferencesAutoselectTour } from './preferences-autoselect'
import { playerStatsTour } from './player-stats'
import { smartXITour } from './smart-xi'
import { profileCustomizationTour } from './profile-customization'

/**
 * Register all tour definitions.
 * Staggered via `showAfter` dates — only 1 auto-starts per session.
 *
 *   Apr 11 — Keyboard Navigation (web users)
 *   Apr 13 — Leaderboard Compare
 *   Apr 15 — Preferences Auto-Select
 *   Apr 17 — Player Stats
 *   Apr 19 — Smart XI
 *   Apr 21 — Profile Customization
 */
export function registerAllTours() {
  registerTour(keyboardNavTour)
  registerTour(leaderboardCompareTour)
  registerTour(preferencesAutoselectTour)
  registerTour(playerStatsTour)
  registerTour(smartXITour)
  registerTour(profileCustomizationTour)
}
