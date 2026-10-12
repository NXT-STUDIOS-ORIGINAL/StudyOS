import { DEFAULT_SETTINGS } from './settings'
import type { Profile, ProfileSettings, ThemeChoice } from './types'

/** Shape of the single row stored by schema v1. */
export interface LegacySettings {
  id: 'main'
  name?: string
  academicYear?: string
  boardClass?: string
  dailyTargetMinutes?: number
  preferredDays?: number[]
  weekStart?: number
  theme?: ThemeChoice
  focusMinutes?: number
  shortBreakMinutes?: number
  longBreakMinutes?: number
  revisionIntervals?: number[]
  gamification?: boolean
  onboarded?: boolean
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isNumArray = (v: unknown): v is number[] => Array.isArray(v) && v.length > 0 && v.every(isNum)
const D = DEFAULT_SETTINGS

/** Converts v1 settings into a default profile. Returns null if v1 never finished onboarding. */
export function legacyToProfile(
  old: LegacySettings | undefined,
  id: string,
  now: number,
): { profile: Profile; settings: ProfileSettings } | null {
  if (!old || old.onboarded !== true) return null
  const daily = isNum(old.dailyTargetMinutes) ? old.dailyTargetMinutes : D.dailyTargetMinutes
  const days = isNumArray(old.preferredDays) ? old.preferredDays : D.preferredDays
  const theme: ThemeChoice =
    old.theme === 'light' || old.theme === 'dark' || old.theme === 'system' ? old.theme : D.theme
  return {
    profile: {
      id,
      displayName: old.name?.trim() || 'My profile',
      nickname: '',
      board: old.boardClass?.trim() ?? '',
      classGrade: '',
      academicYear: old.academicYear?.trim() ?? '',
      schoolName: '',
      avatar: { kind: 'default', key: 'indigo' },
      createdAt: now,
      lastActiveAt: now,
    },
    settings: {
      profileId: id,
      dailyTargetMinutes: daily,
      weeklyTargetMinutes: daily * days.length,
      preferredDays: days,
      weekStart: isNum(old.weekStart) ? old.weekStart : D.weekStart,
      theme,
      focusMinutes: isNum(old.focusMinutes) ? old.focusMinutes : D.focusMinutes,
      shortBreakMinutes: isNum(old.shortBreakMinutes) ? old.shortBreakMinutes : D.shortBreakMinutes,
      longBreakMinutes: isNum(old.longBreakMinutes) ? old.longBreakMinutes : D.longBreakMinutes,
      revisionIntervals: isNumArray(old.revisionIntervals) ? old.revisionIntervals : D.revisionIntervals,
      gamification: old.gamification === true,
      updatedAt: now,
    },
  }
}
