import { describe, expect, it } from 'vitest'
import type { ActivityRecord, ActivityStatus, ActivityType } from './types'
import {
  buildSlots, chapterStatus, completion, coverage, dedupeRecords, latestCompletion, perType, tally,
} from './progress'

const type = (id: string, subjectId = 's', o: Partial<ActivityType> = {}): ActivityType => ({
  id, profileId: 'p', subjectId, name: id, order: 0, enabled: true, weight: null, role: 'other',
  createdAt: 0, updatedAt: 0, ...o,
})
const chap = (id: string, subjectId = 's') => ({ id, subjectId })
const rec = (chapterId: string, typeId: string, status: ActivityStatus, o: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: `${chapterId}:${typeId}`, profileId: 'p', chapterId, activityTypeId: typeId, status,
  completedAt: status === 'done' ? 100 : null, notes: '', source: '', estimatedMinutes: null,
  actualMinutes: null, history: [], createdAt: 0, updatedAt: 0, ...o,
})

describe('independent activities', () => {
  it('counts each activity separately', () => {
    const types = [type('theory'), type('practice')]
    const chapters = [chap('c1'), chap('c2')]
    const slots = buildSlots(types, chapters, [rec('c1', 'theory', 'done')])
    const rows = perType(slots, types)
    expect(rows.find((r) => r.typeId === 'theory')).toMatchObject({ done: 1, applicable: 2 })
    expect(rows.find((r) => r.typeId === 'practice')).toMatchObject({ done: 0, applicable: 2 })
  })
  it('leaves out disabled activities and other subjects’ activities', () => {
    const types = [type('theory'), type('pyq', 's', { enabled: false }), type('other', 'x')]
    expect(buildSlots(types, [chap('c1')], [])).toHaveLength(1)
  })
})

describe('applicability', () => {
  it('excludes not-applicable activities from the denominator', () => {
    const types = [type('theory'), type('practice')]
    const slots = buildSlots(types, [chap('c1')], [rec('c1', 'theory', 'done'), rec('c1', 'practice', 'na')])
    const t = tally(slots)
    expect(t).toMatchObject({ done: 1, applicable: 1 })
    expect(completion(t).unweighted).toBe(1)
  })
  it('never treats a chapter with no applicable activities as complete', () => {
    const types = [type('theory')]
    const slots = buildSlots(types, [chap('c1'), chap('c2')], [rec('c1', 'theory', 'na'), rec('c2', 'theory', 'done')])
    expect(chapterStatus(slots.filter((s) => s.chapterId === 'c1'))).toBe('no-activities')
    const cov = coverage(slots, ['c1', 'c2'])
    expect(cov.withoutApplicable).toBe(1)
    expect(cov.complete).toBe(1)
    expect(completion(tally([])).unweighted).toBeNull()
  })
})

describe('weights', () => {
  it('weighted and unweighted differ when weights differ', () => {
    const types = [type('theory', 's', { weight: 1 }), type('practice', 's', { weight: 3 })]
    const t = tally(buildSlots(types, [chap('c1')], [rec('c1', 'theory', 'done')]))
    const c = completion(t)
    expect(c.unweighted).toBeCloseTo(0.5)
    expect(c.weighted).toBeCloseTo(0.25)
  })
  it('treats an empty weight as 1', () => {
    const t = tally(buildSlots([type('a'), type('b', 's', { weight: 1 })], [chap('c1')], [rec('c1', 'a', 'done')]))
    expect(completion(t).weighted).toBeCloseTo(0.5)
  })
})

describe('coverage versus completion', () => {
  it('measures breadth separately from depth', () => {
    const types = [type('theory'), type('practice')]
    const chapters = [chap('c1'), chap('c2'), chap('c3'), chap('c4')]
    const records = [rec('c1', 'theory', 'done'), rec('c1', 'practice', 'done'), rec('c2', 'theory', 'done')]
    const slots = buildSlots(types, chapters, records)
    expect(completion(tally(slots)).unweighted).toBeCloseTo(3 / 8)
    const cov = coverage(slots, chapters.map((c) => c.id))
    expect(cov.coverage).toBeCloseTo(0.5)
    expect(cov.complete).toBe(1)
  })
})

describe('chapter status and history', () => {
  it('distinguishes not started, in progress and all done', () => {
    const types = [type('a'), type('b')]
    const status = (records: ActivityRecord[]) => chapterStatus(buildSlots(types, [chap('c')], records))
    expect(status([])).toBe('not-started')
    expect(status([rec('c', 'a', 'done')])).toBe('in-progress')
    expect(status([rec('c', 'a', 'done'), rec('c', 'b', 'done')])).toBe('all-done')
  })
  it('keeps only the latest of duplicate records', () => {
    const out = dedupeRecords([rec('c', 'a', 'todo', { id: 'x', updatedAt: 1 }), rec('c', 'a', 'done', { id: 'y', updatedAt: 5 })])
    expect(out).toHaveLength(1)
    expect(out[0].status).toBe('done')
  })
  it('finds the latest completion among enabled activities', () => {
    const rs = [rec('c', 'a', 'done', { completedAt: 5 }), rec('c', 'b', 'done', { completedAt: 9 }), rec('c', 'z', 'done', { completedAt: 50 })]
    expect(latestCompletion(rs, ['a', 'b'])).toBe(9)
    expect(latestCompletion([], ['a'])).toBeNull()
  })
})
