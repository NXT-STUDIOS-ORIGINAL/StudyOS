import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  name: '',
  academicYear: '',
  boardClass: '',
  dailyTargetMinutes: 180,
  preferredDays: [1, 2, 3, 4, 5, 6],
  weekStart: 1,
  theme: 'system',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  revisionIntervals: [1, 3, 7, 14, 30],
  gamification: false,
  onboarded: false,
  updatedAt: 0,
}

/** Parses "1, 3, 7" into [1, 3, 7]. Returns null if invalid. */
export function parseIntervals(text: string): number[] | null {
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 365)) return null
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1]) return null
  }
  return nums
}

export function validateSettings(s: Settings): string[] {
  const errors: string[] = []
  const inRange = (n: number, min: number, max: number) =>
    Number.isFinite(n) && n >= min && n <= max
  if (!inRange(s.dailyTargetMinutes, 15, 1440))
    errors.push('Daily study target must be between 0.25 and 24 hours.')
  if (!inRange(s.focusMinutes, 1, 240))
    errors.push('Focus session must be 1 to 240 minutes.')
  if (!inRange(s.shortBreakMinutes, 1, 60))
    errors.push('Short break must be 1 to 60 minutes.')
  if (!inRange(s.longBreakMinutes, 1, 120))
    errors.push('Long break must be 1 to 120 minutes.')
  if (s.revisionIntervals.length === 0)
    errors.push('Revision intervals must be whole days, increasing, e.g. 1, 3, 7, 14, 30.')
  if (s.preferredDays.length === 0)
    errors.push('Select at least one study day.')
  return errors
}
