import type { Chapter } from '../syllabus/types'
import type { ActivityRecord, ActivityType } from './types'

export interface Slot {
  chapterId: string
  subjectId: string
  typeId: string
  weight: number
  applicable: boolean
  done: boolean
}

/** If duplicates exist for one chapter+activity (e.g. after merging devices), the latest update wins. */
export function dedupeRecords(records: ActivityRecord[]): ActivityRecord[] {
  const best = new Map<string, ActivityRecord>()
  for (const r of records) {
    const k = `${r.chapterId}|${r.activityTypeId}`
    const cur = best.get(k)
    if (!cur || r.updatedAt > cur.updatedAt) best.set(k, r)
  }
  return [...best.values()]
}

/**
 * One slot per (chapter, enabled activity of that chapter's subject).
 * Disabled activities make no slot. "Not applicable" slots exist but are excluded from totals.
 */
export function buildSlots(
  types: ActivityType[], chapters: Pick<Chapter, 'id' | 'subjectId'>[], records: ActivityRecord[],
): Slot[] {
  const rec = new Map(dedupeRecords(records).map((r) => [`${r.chapterId}|${r.activityTypeId}`, r]))
  const slots: Slot[] = []
  for (const ch of chapters) {
    for (const t of types) {
      if (!t.enabled || t.subjectId !== ch.subjectId) continue
      const r = rec.get(`${ch.id}|${t.id}`)
      slots.push({
        chapterId: ch.id, subjectId: ch.subjectId, typeId: t.id,
        weight: t.weight !== null && t.weight > 0 ? t.weight : 1,
        applicable: r?.status !== 'na', done: r?.status === 'done',
      })
    }
  }
  return slots
}

export interface Tally { done: number; applicable: number; weightedDone: number; weightedApplicable: number }

export function tally(slots: Slot[]): Tally {
  const t: Tally = { done: 0, applicable: 0, weightedDone: 0, weightedApplicable: 0 }
  for (const s of slots) {
    if (!s.applicable) continue
    t.applicable++
    t.weightedApplicable += s.weight
    if (s.done) { t.done++; t.weightedDone += s.weight }
  }
  return t
}

export const ratio = (n: number, d: number): number | null => (d === 0 ? null : n / d)

export function completion(t: Tally): { unweighted: number | null; weighted: number | null } {
  return { unweighted: ratio(t.done, t.applicable), weighted: ratio(t.weightedDone, t.weightedApplicable) }
}

export interface Coverage {
  withApplicable: number
  withoutApplicable: number
  touched: number
  complete: number
  coverage: number | null
}

/** Breadth: chapters with at least one ticked activity, out of chapters with at least one applicable activity. */
export function coverage(slots: Slot[], chapterIds: string[]): Coverage {
  const by = new Map<string, Slot[]>()
  for (const s of slots) {
    if (!s.applicable) continue
    const a = by.get(s.chapterId)
    if (a) a.push(s)
    else by.set(s.chapterId, [s])
  }
  let touched = 0
  let complete = 0
  for (const arr of by.values()) {
    const d = arr.filter((s) => s.done).length
    if (d > 0) touched++
    if (d === arr.length) complete++
  }
  return {
    withApplicable: by.size,
    withoutApplicable: chapterIds.filter((id) => !by.has(id)).length,
    touched, complete, coverage: ratio(touched, by.size),
  }
}

export interface TypeProgress { typeId: string; name: string; done: number; applicable: number; ratio: number | null }

export function perType(slots: Slot[], types: ActivityType[]): TypeProgress[] {
  return types.filter((t) => t.enabled).map((t) => {
    const mine = slots.filter((s) => s.typeId === t.id && s.applicable)
    const done = mine.filter((s) => s.done).length
    return { typeId: t.id, name: t.name, done, applicable: mine.length, ratio: ratio(done, mine.length) }
  })
}

export type ChapterStatus = 'no-activities' | 'not-started' | 'in-progress' | 'all-done'

export const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  'no-activities': 'No applicable activities',
  'not-started': 'Not started',
  'in-progress': 'In progress',
  'all-done': 'All activities done',
}

export function chapterStatus(slots: Slot[]): ChapterStatus {
  const t = tally(slots)
  if (t.applicable === 0) return 'no-activities'
  if (t.done === 0) return 'not-started'
  return t.done === t.applicable ? 'all-done' : 'in-progress'
}

export function latestCompletion(records: ActivityRecord[], typeIds: string[]): number | null {
  let latest: number | null = null
  for (const r of records) {
    if (r.status !== 'done' || r.completedAt === null || !typeIds.includes(r.activityTypeId)) continue
    if (latest === null || r.completedAt > latest) latest = r.completedAt
  }
  return latest
}

export const COMPLETION_EXPLANATION =
  'Activity completion = ticked activities ÷ applicable activities, across all chapters. A chapter with 3 of 10 ticked contributes 3 of 10. ' +
  'Weighted counts each activity by its weight (empty weight = 1); unweighted counts every activity equally. ' +
  'Disabled and not-applicable activities are left out of both.'

export const COVERAGE_EXPLANATION =
  'Chapter coverage = chapters with at least one ticked activity ÷ chapters with at least one applicable activity. ' +
  'It shows how much of the syllabus you have started, not how deeply. Chapters with no applicable activities are excluded, never counted as complete.'

export const NOT_MASTERY_NOTE =
  'Ticking activities records work done. It does not measure how well you know a chapter; test results will be used for that.'
