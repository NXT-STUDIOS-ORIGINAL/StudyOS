import { describe, expect, it } from 'vitest'
import { emptyTaskDraft, validateTaskDraft, validateTaskRecord } from './rules'

const ok = { ...emptyTaskDraft(), title: 'Revise optics' }

describe('validateTaskDraft', () => {
  it('accepts a minimal task and optional fields', () => {
    expect(validateTaskDraft(ok)).toEqual([])
    expect(validateTaskDraft({ ...ok, plannedMinutes: 45, dueDate: '2026-10-20', startDate: '2026-10-18' })).toEqual([])
  })
  it('rejects empty titles, bad minutes and bad dates', () => {
    expect(validateTaskDraft({ ...ok, title: '  ' })).not.toEqual([])
    expect(validateTaskDraft({ ...ok, plannedMinutes: -1 })).not.toEqual([])
    expect(validateTaskDraft({ ...ok, plannedMinutes: NaN })).not.toEqual([])
    expect(validateTaskDraft({ ...ok, dueDate: '2026-02-31' })).not.toEqual([])
    expect(validateTaskDraft({ ...ok, startDate: '2026-10-20', dueDate: '2026-10-18' })).not.toEqual([])
  })
  it('needs a subject for a chapter link', () => {
    expect(validateTaskDraft({ ...ok, chapterId: 'c1' })).not.toEqual([])
    expect(validateTaskDraft({ ...ok, subjectId: 's1', chapterId: 'c1' })).toEqual([])
  })
})

describe('validateTaskRecord', () => {
  const row = {
    id: 't1', profileId: 'p', title: 'T', notes: '', status: 'todo', priority: 'normal', subjectId: null,
    chapterId: null, plannedMinutes: null, actualMinutes: null, startDate: null, dueDate: null,
    completedAt: null, createdAt: 1, updatedAt: 1,
  }
  it('accepts a valid record and rejects other owners and bad values', () => {
    expect(validateTaskRecord(row, 'p')).toEqual([])
    expect(validateTaskRecord(row, 'q')).not.toEqual([])
    expect(validateTaskRecord({ ...row, status: 'maybe' }, 'p')).not.toEqual([])
    expect(validateTaskRecord({ ...row, dueDate: 'tomorrow' }, 'p')).not.toEqual([])
    expect(validateTaskRecord({ ...row, chapterId: 'c' }, 'p')).not.toEqual([])
  })
})
