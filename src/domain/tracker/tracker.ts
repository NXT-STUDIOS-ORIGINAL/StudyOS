import type { Chapter } from '../syllabus/types'
import type { ActivityRecord, ActivityType } from '../activity/types'
import { buildSlots, chapterStatus, dedupeRecords } from '../activity/progress'

export type TrackerView = 'compact' | 'detailed'
export type ChapterFilter = 'all' | 'incomplete' | 'overdue' | 'completed' | 'pinned'

export const TRACKER_VIEWS: TrackerView[] = ['compact', 'detailed']
export const CHAPTER_FILTERS: ChapterFilter[] = ['all', 'incomplete', 'overdue', 'completed', 'pinned']
export const FILTER_LABELS: Record<ChapterFilter, string> = {
  all: 'All chapters', incomplete: 'Incomplete', overdue: 'Overdue', completed: 'All done', pinned: 'Pinned',
}

export interface TrackerPrefs {
  profileId: string
  view: TrackerView
  defaultSubjectId: string | null // null = reopen the last used subject
  lastSubjectId: string | null
  filter: ChapterFilter
  updatedAt: number
}

export const defaultTrackerPrefs = (profileId: string): TrackerPrefs => ({
  profileId, view: 'compact', defaultSubjectId: null, lastSubjectId: null, filter: 'all', updatedAt: 0,
})

export function validateTrackerPrefsRecord(row: unknown, ownerId: string): string[] {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return ['record is not an object']
  const r = row as Record<string, unknown>
  const e: string[] = []
  const idOrNull = (v: unknown) => v === null || (typeof v === 'string' && v.length > 0)
  if (r.profileId !== ownerId) e.push('record belongs to a different profile')
  if (!TRACKER_VIEWS.includes(r.view as TrackerView)) e.push('view is not recognised')
  if (!CHAPTER_FILTERS.includes(r.filter as ChapterFilter)) e.push('filter is not recognised')
  if (!idOrNull(r.defaultSubjectId)) e.push('defaultSubjectId must be text or null')
  if (!idOrNull(r.lastSubjectId)) e.push('lastSubjectId must be text or null')
  if (typeof r.updatedAt !== 'number' || !Number.isFinite(r.updatedAt)) e.push('updatedAt must be a number')
  return e
}

export interface FilterInput {
  chapters: Chapter[]
  types: ActivityType[]
  records: ActivityRecord[]
  query: string
  filter: ChapterFilter
  today: string // yyyy-MM-dd, the user's local date
}

/** Search by name, then apply the filter. "Overdue" = target date passed and not all activities done. */
export function filterChapters(i: FilterInput): Chapter[] {
  const q = i.query.trim().toLowerCase()
  const byChapter = new Map<string, ActivityRecord[]>()
  for (const r of dedupeRecords(i.records)) {
    const arr = byChapter.get(r.chapterId)
    if (arr) arr.push(r)
    else byChapter.set(r.chapterId, [r])
  }
  return i.chapters.filter((ch) => {
    if (q && !ch.name.toLowerCase().includes(q)) return false
    if (i.filter === 'all') return true
    if (i.filter === 'pinned') return ch.pinned === true
    const status = chapterStatus(buildSlots(i.types, [ch], byChapter.get(ch.id) ?? []))
    const open = status === 'not-started' || status === 'in-progress'
    if (i.filter === 'completed') return status === 'all-done'
    if (i.filter === 'incomplete') return open
    return open && ch.targetDate !== null && ch.targetDate < i.today
  })
}

/** First enabled activity (in your order) that is still to do. Done and not-applicable ones are skipped. */
export function nextDueActivity(types: ActivityType[], chapterRecords: ActivityRecord[]): ActivityType | null {
  const status = new Map(chapterRecords.map((r) => [r.activityTypeId, r.status]))
  return [...types]
    .filter((t) => t.enabled)
    .sort((a, b) => a.order - b.order)
    .find((t) => (status.get(t.id) ?? 'todo') === 'todo') ?? null
}
