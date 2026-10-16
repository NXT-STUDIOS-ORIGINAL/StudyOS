import { describe, expect, it } from 'vitest'
import type { Chapter } from '../syllabus/types'
import type { ActivityRecord, ActivityStatus, ActivityType } from '../activity/types'
import { defaultTrackerPrefs, filterChapters, nextDueActivity, validateTrackerPrefsRecord } from './tracker'

const type = (id: string, order: number, o: Partial<ActivityType> = {}): ActivityType => ({
  id, profileId: 'p', subjectId: 's', name: id, order, enabled: true, weight: null, role: 'other',
  createdAt: 0, updatedAt: 0, ...o,
})
const ch = (id: string, o: Partial<Chapter> = {}): Chapter => ({
  id, profileId: 'p', subjectId: 's', name: id, order: 0, weight: null, estimatedMinutes: null,
  targetDate: null, notes: '', createdAt: 0, updatedAt: 0, ...o,
})
const rec = (chapterId: string, typeId: string, status: ActivityStatus): ActivityRecord => ({
  id: `${chapterId}:${typeId}`, profileId: 'p', chapterId, activityTypeId: typeId, status,
  completedAt: status === 'done' ? 1 : null, notes: '', source: '', estimatedMinutes: null,
  actualMinutes: null, history: [], createdAt: 0, updatedAt: 0,
})

describe('nextDueActivity', () => {
  const types = [type('b', 1), type('a', 0), type('c', 2, { enabled: false })]
  it('returns the first enabled activity still to do, in your order', () => {
    expect(nextDueActivity(types, [])?.id).toBe('a')
    expect(nextDueActivity(types, [rec('x', 'a', 'done')])?.id).toBe('b')
  })
  it('skips not-applicable activities and returns null when nothing is left', () => {
    expect(nextDueActivity(types, [rec('x', 'a', 'na')])?.id).toBe('b')
    expect(nextDueActivity(types, [rec('x', 'a', 'done'), rec('x', 'b', 'done')])).toBeNull()
  })
})

describe('filterChapters', () => {
  const types = [type('t', 0), type('u', 1)]
  const chapters = [
    ch('Algebra', { targetDate: '2026-01-01' }), ch('Geometry', { pinned: true }),
    ch('Trigonometry', { targetDate: '2999-01-01' }), ch('Statistics'),
  ]
  const records = [
    rec('Algebra', 't', 'done'), rec('Geometry', 't', 'done'), rec('Geometry', 'u', 'done'),
    rec('Trigonometry', 't', 'na'), rec('Trigonometry', 'u', 'na'),
  ]
  const run = (filter: Parameters<typeof filterChapters>[0]['filter'], query = '') =>
    filterChapters({ chapters, types, records, query, filter, today: '2026-06-01' }).map((c) => c.id)

  it('searches names case-insensitively', () => {
    expect(run('all', 'GEO')).toEqual(['Geometry'])
    expect(run('all', '  ')).toHaveLength(4)
  })
  it('filters incomplete, completed, pinned', () => {
    expect(run('incomplete')).toEqual(['Algebra', 'Statistics'])
    expect(run('completed')).toEqual(['Geometry'])
    expect(run('pinned')).toEqual(['Geometry'])
  })
  it('treats chapters with no applicable activities as neither incomplete nor completed', () => {
    expect(run('incomplete')).not.toContain('Trigonometry')
    expect(run('completed')).not.toContain('Trigonometry')
  })
  it('overdue needs a past target date and unfinished work', () => {
    expect(run('overdue')).toEqual(['Algebra'])
  })
})

describe('tracker prefs validation', () => {
  it('accepts defaults and rejects bad values or another owner', () => {
    expect(validateTrackerPrefsRecord(defaultTrackerPrefs('p'), 'p')).toEqual([])
    expect(validateTrackerPrefsRecord(defaultTrackerPrefs('p'), 'q')).not.toEqual([])
    expect(validateTrackerPrefsRecord({ ...defaultTrackerPrefs('p'), view: 'huge' }, 'p')).not.toEqual([])
    expect(validateTrackerPrefsRecord({ ...defaultTrackerPrefs('p'), filter: 'x' }, 'p')).not.toEqual([])
    expect(validateTrackerPrefsRecord({ ...defaultTrackerPrefs('p'), lastSubjectId: '' }, 'p')).not.toEqual([])
  })
})
