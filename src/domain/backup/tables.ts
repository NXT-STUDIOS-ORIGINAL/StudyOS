import { validateSettings } from '../settings'
import { validateActivityRecord, validateActivityTypeRecord } from '../activity/validate'
import { validateChapterRecord, validateSubjectRecord, validateTopicRecord } from '../syllabus/validate'
import { validateTaskRecord } from '../tasks/rules'
import { validateTrackerPrefsRecord } from '../tracker/tracker'
import { isNum, isNumArr, isRecord } from './guards'

/**
 * One entry per profile-owned table. The order must match PROFILE_OWNED_TABLES in lib/db.ts
 * (a test enforces this). Parents come before children.
 */
export interface BackupTableSpec {
  name: string
  pk: string
  label: string // singular, used in counts
  /** Foreign keys to other tables of the same profile. "soft" refs may point at deleted records. */
  refs: { field: string; table: string; soft?: boolean }[]
  /** Fields that together must be unique within one profile (checked on import). */
  unique?: string[]
  validateRow: (row: unknown, ownerId: string) => string[]
}

function validateSettingsRow(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const errs: string[] = []
  if (row.profileId !== ownerId) errs.push('record belongs to a different profile')
  const numberKeys = [
    'dailyTargetMinutes',
    'weeklyTargetMinutes',
    'weekStart',
    'focusMinutes',
    'shortBreakMinutes',
    'longBreakMinutes',
    'updatedAt',
  ] as const
  for (const k of numberKeys) {
    if (!isNum(row[k])) errs.push(`${k} must be a number`)
  }
  const daysOk =
    isNumArr(row.preferredDays) &&
    row.preferredDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (!daysOk) errs.push('preferredDays must be day numbers 0 to 6')
  if (!isNumArr(row.revisionIntervals)) errs.push('revisionIntervals must be a list of numbers')
  if (row.theme !== 'light' && row.theme !== 'dark' && row.theme !== 'system') {
    errs.push('theme must be light, dark or system')
  }
  if (typeof row.gamification !== 'boolean') errs.push('gamification must be true or false')
  if (isNum(row.weekStart) && (!Number.isInteger(row.weekStart) || row.weekStart < 0 || row.weekStart > 6)) {
    errs.push('weekStart must be 0 to 6')
  }
  if (errs.length > 0) return errs
  return validateSettings({
    dailyTargetMinutes: row.dailyTargetMinutes as number,
    weeklyTargetMinutes: row.weeklyTargetMinutes as number,
    preferredDays: row.preferredDays as number[],
    weekStart: row.weekStart as number,
    theme: row.theme as 'light' | 'dark' | 'system',
    focusMinutes: row.focusMinutes as number,
    shortBreakMinutes: row.shortBreakMinutes as number,
    longBreakMinutes: row.longBreakMinutes as number,
    revisionIntervals: row.revisionIntervals as number[],
    gamification: row.gamification as boolean,
  })
}

export const BACKUP_TABLES: BackupTableSpec[] = [
  {
    name: 'profileSettings',
    pk: 'profileId',
    label: 'settings record',
    refs: [],
    validateRow: validateSettingsRow,
  },
  {
    name: 'subjects',
    pk: 'id',
    label: 'subject',
    refs: [],
    validateRow: validateSubjectRecord,
  },
  {
    name: 'activityTypes',
    pk: 'id',
    label: 'activity type',
    refs: [{ field: 'subjectId', table: 'subjects' }],
    validateRow: validateActivityTypeRecord,
  },
  {
    name: 'chapters',
    pk: 'id',
    label: 'chapter',
    refs: [{ field: 'subjectId', table: 'subjects' }],
    validateRow: validateChapterRecord,
  },
  {
    name: 'topics',
    pk: 'id',
    label: 'topic',
    refs: [{ field: 'chapterId', table: 'chapters' }],
    validateRow: validateTopicRecord,
  },
  {
    name: 'activityRecords',
    pk: 'id',
    label: 'activity record',
    refs: [
      { field: 'chapterId', table: 'chapters' },
      { field: 'activityTypeId', table: 'activityTypes' },
    ],
    unique: ['chapterId', 'activityTypeId'],
    validateRow: validateActivityRecord,
  },
  {
    // "Soft" refs: a remembered subject that was deleted later must not make a backup invalid.
    name: 'trackerPrefs',
    pk: 'profileId',
    label: 'tracker preference',
    refs: [
      { field: 'defaultSubjectId', table: 'subjects', soft: true },
      { field: 'lastSubjectId', table: 'subjects', soft: true },
    ],
    validateRow: validateTrackerPrefsRecord,
  },
  {
    name: 'tasks',
    pk: 'id',
    label: 'task',
    refs: [
      { field: 'subjectId', table: 'subjects' },
      { field: 'chapterId', table: 'chapters' },
    ],
    validateRow: validateTaskRecord,
  },
]
