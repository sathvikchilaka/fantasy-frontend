import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchMatches,
  fetchMatchesbyid,
  fetchMatchLeaderboard,
  fetchOverallLeaderboard,
  fetchScorecard,
  createTeam,
} from '@/api/matchesApi'
import { getUserProfile, updateGameName, uploadProfilePicture } from '@/api/profileApi'
import type { CreateDreamTeamBody } from '@/types/api'

// ── Query keys ──────────────────────────────────────────

export const queryKeys = {
  matches: ['matches'] as const,
  match: (id: number) => ['match', id] as const,
  scorecard: (id: number) => ['scorecard', id] as const,
  matchLeaderboard: (id: number) => ['matchLeaderboard', id] as const,
  overallLeaderboard: ['overallLeaderboard'] as const,
  userProfile: ['userProfile'] as const,
}

// ── Matches ─────────────────────────────────────────────

export function useMatches() {
  return useQuery({
    queryKey: queryKeys.matches,
    queryFn: fetchMatches,
  })
}

/** Single match data (players + dreamTeam). Replaces both fetchMatchesbyid and fetchMatchSelection. */
export function useMatch(matchId: number) {
  return useQuery({
    queryKey: queryKeys.match(matchId),
    queryFn: () => fetchMatchesbyid(matchId),
    enabled: Number.isFinite(matchId),
  })
}

// ── Scorecard ───────────────────────────────────────────

export function useScorecard(matchId: number) {
  return useQuery({
    queryKey: queryKeys.scorecard(matchId),
    queryFn: () => fetchScorecard(matchId),
    enabled: Number.isFinite(matchId),
  })
}

// ── Match leaderboard ───────────────────────────────────

export function useMatchLeaderboard(matchId: number) {
  return useQuery({
    queryKey: queryKeys.matchLeaderboard(matchId),
    queryFn: () => fetchMatchLeaderboard(matchId),
    enabled: Number.isFinite(matchId),
  })
}

// ── Overall leaderboard ─────────────────────────────────

export function useOverallLeaderboard() {
  return useQuery({
    queryKey: queryKeys.overallLeaderboard,
    queryFn: fetchOverallLeaderboard,
  })
}

// ── Profile ─────────────────────────────────────────────

export function useUserProfile(enabled = true) {
  return useQuery({
    queryKey: queryKeys.userProfile,
    queryFn: getUserProfile,
    enabled,
  })
}

export function useUpdateGameName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (gameName: string) => updateGameName(gameName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.userProfile }) },
  })
}

export function useUploadProfilePicture() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => uploadProfilePicture(file),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.userProfile }) },
  })
}

// ── Create team (mutation) ──────────────────────────────

export function useCreateTeam(matchId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateDreamTeamBody) => createTeam(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.match(matchId) })
      qc.invalidateQueries({ queryKey: queryKeys.matchLeaderboard(matchId) })
    },
  })
}

// ── Helpers ─────────────────────────────────────────────

/** Imperatively refetch scorecard + leaderboard (for SSE refresh events). */
export function useRefreshMatchData(matchId: number) {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.scorecard(matchId) })
    qc.invalidateQueries({ queryKey: queryKeys.matchLeaderboard(matchId) })
  }
}
