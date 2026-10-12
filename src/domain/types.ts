export type ThemeChoice = 'light' | 'dark' | 'system'

export type Avatar =
  | { kind: 'default'; key: string }
  | { kind: 'image'; dataUrl: string }

export interface Profile {
  id: string
  displayName: string
  nickname: string
  board: string
  classGrade: string
  academicYear: string
  schoolName: string
  avatar: Avatar
  createdAt: number
  lastActiveAt: number
}
export type ProfileDraft = Omit<Profile, 'id' | 'createdAt' | 'lastActiveAt'>

export interface ProfileSettings {
  profileId: string
  dailyTargetMinutes: number
  weeklyTargetMinutes: number
  preferredDays: number[] // 0 = Sunday ... 6 = Saturday
  weekStart: number
  theme: ThemeChoice
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  revisionIntervals: number[]
  gamification: boolean
  updatedAt: number
}
export type SettingsDraft = Omit<ProfileSettings, 'profileId' | 'updatedAt'>
