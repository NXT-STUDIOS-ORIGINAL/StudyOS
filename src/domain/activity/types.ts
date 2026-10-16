export type ActivityRole = 'study' | 'practice' | 'revision' | 'test' | 'correction' | 'other'
export const ACTIVITY_ROLES: ActivityRole[] = ['study', 'practice', 'revision', 'test', 'correction', 'other']
export const ROLE_LABELS: Record<ActivityRole, string> = {
  study: 'Study / notes', practice: 'Practice', revision: 'Revision',
  test: 'Test', correction: 'Mistake correction', other: 'Other',
}

export type ActivityStatus = 'todo' | 'done' | 'na'
export const ACTIVITY_STATUSES: ActivityStatus[] = ['todo', 'done', 'na']

export const MAX_ACTIVITY_NAME = 60
export const MAX_HISTORY = 100

export interface ActivityType {
  id: string
  profileId: string
  subjectId: string | null // null = the default set copied into new subjects
  name: string
  order: number
  enabled: boolean
  weight: number | null // null counts as 1
  role: ActivityRole
  showInCompact?: boolean // one-tap chip on the chapter card; missing = true
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry { at: number; from: ActivityStatus; to: ActivityStatus }

/** Sparse: no record means "to do". One record per chapter and activity type. */
export interface ActivityRecord {
  id: string
  profileId: string
  chapterId: string
  activityTypeId: string
  status: ActivityStatus
  completedAt: number | null
  notes: string
  source: string
  estimatedMinutes: number | null
  actualMinutes: number | null
  history: HistoryEntry[]
  createdAt: number
  updatedAt: number
}

export type ActivityTypeDraft = Pick<ActivityType, 'name' | 'enabled' | 'weight' | 'role' | 'showInCompact'>

export const recordId = (chapterId: string, activityTypeId: string): string => `${chapterId}:${activityTypeId}`
