import { UserPen } from 'lucide-react'
import type { TourDef } from '../tours'

export const profileCustomizationTour: TourDef = {
  id: 'profile-customization-v1',
  title: 'Customize Your Profile',
  description:
    'Set your game name and profile picture — this is how others see you on the leaderboard.',
  icon: UserPen,
  showAfter: '2026-04-21',
  steps: [
    {
      selector: '[data-tour="profile-avatar"]',
      route: '/profile',
      title: 'Profile Picture',
      description:
        'Hover (or tap on mobile) your avatar to change your photo. This shows up next to your name on leaderboards.',
      side: 'bottom',
    },
    {
      selector: '[data-tour="profile-game-name"]',
      route: '/profile',
      title: 'Game Name',
      description:
        'Set your game name — this is how you appear on the leaderboard. Pick something your friends will recognize!',
      side: 'top',
    },
  ],
}
