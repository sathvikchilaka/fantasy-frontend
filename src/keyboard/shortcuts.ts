export type ShortcutDef = {
  id: string
  keys: string[]
  label: string
  description: string
  group: string
}

export const SHORTCUT_GROUPS = [
  'Global',
  'Navigation',
  'Match Detail',
  'Team Builder',
  'Leaderboard',
] as const

export const ALL_SHORTCUTS: ShortcutDef[] = [
  // Global
  { id: 'help', keys: ['?'], label: 'Keyboard shortcuts', description: 'Shows this keyboard shortcuts reference modal.', group: 'Global' },
  { id: 'esc', keys: ['Esc'], label: 'Close modal / drawer', description: 'Closes any open modal, drawer, or sheet overlay.', group: 'Global' },
  { id: 'go-back', keys: ['Backspace'], label: 'Go back', description: 'Navigates to the previous page, like the browser back button.', group: 'Global' },

  // Navigation
  { id: 'nav-home', keys: ['g', 'h'], label: 'Go to Home', description: 'Press g then h to navigate to the Home page.', group: 'Navigation' },
  { id: 'nav-matches', keys: ['g', 'm'], label: 'Go to Matches', description: 'Press g then m to navigate to the Matches page.', group: 'Navigation' },
  { id: 'nav-profile', keys: ['g', 'p'], label: 'Go to Profile', description: 'Press g then p to navigate to your Profile page.', group: 'Navigation' },

  // Match Detail
  { id: 'md-tab-1', keys: ['1'], label: 'Scorecard tab', description: 'Switches to the Scorecard tab on the match detail page.', group: 'Match Detail' },
  { id: 'md-tab-2', keys: ['2'], label: 'Leaderboard tab', description: 'Switches to the Leaderboard tab on the match detail page.', group: 'Match Detail' },
  { id: 'md-tab-3', keys: ['3'], label: 'Player Stats tab', description: 'Switches to the Player Stats tab on the match detail page.', group: 'Match Detail' },
  { id: 'md-arrows', keys: ['←', '→'], label: 'Previous / next tab', description: 'Use arrow keys to cycle between match detail tabs.', group: 'Match Detail' },
  { id: 'md-cycle', keys: ['t'], label: 'Cycle tabs forward', description: 'Cycles to the next tab in order (Scorecard → Leaderboard → Player Stats).', group: 'Match Detail' },
  { id: 'md-lb', keys: ['l'], label: 'Leaderboard tab', description: 'Jumps directly to the Leaderboard tab.', group: 'Match Detail' },
  { id: 'md-create', keys: ['c'], label: 'Create / edit squad', description: 'Opens the team builder to create or edit your squad for this match.', group: 'Match Detail' },

  // Team Builder
  { id: 'tb-smart', keys: ['s'], label: 'Smart Pick', description: 'Auto-picks a balanced XI based on player credits and form.', group: 'Team Builder' },
  { id: 'tb-save', keys: ['Enter'], label: 'Save team', description: 'Saves your squad when all selections are valid.', group: 'Team Builder' },
  { id: 'tb-remove', keys: ['Del'], label: 'Remove last player', description: 'Removes the most recently selected player from your squad.', group: 'Team Builder' },

  // Leaderboard
  { id: 'lb-nav', keys: ['↑', '↓'], label: 'Navigate rows', description: 'Move focus up or down through leaderboard rows.', group: 'Leaderboard' },
  { id: 'lb-expand', keys: ['Enter'], label: 'Expand / collapse row', description: 'Expands or collapses the focused leaderboard row to show match stats.', group: 'Leaderboard' },
  { id: 'lb-expand-e', keys: ['e'], label: 'Expand focused row', description: 'Alternative key to expand the currently focused leaderboard row.', group: 'Leaderboard' },
]

// ── Preference helpers (localStorage) ──

const STORAGE_KEY = 'keyboard-shortcuts-disabled'

export function getDisabledShortcuts(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw))
  } catch {
    return new Set()
  }
}

export function setDisabledShortcuts(disabled: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...disabled]))
}
