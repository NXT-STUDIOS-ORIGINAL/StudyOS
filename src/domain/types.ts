export type ThemeChoice = 'light' | 'dark' | 'system'

export interface Settings {
  id: 'main'
  name: string
  academicYear: string
  boardClass: string
  dailyTargetMinutes: number
  preferredDays: number[] // 0 = Sunday ... 6 = Saturday
  weekStart: number // 0 = Sunday, 1 = Monday ...
  theme: ThemeChoice
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  revisionIntervals: number[] // days, strictly increasing
  gamification: boolean
  onboarded: boolean
  updatedAt: number // epoch ms
}
