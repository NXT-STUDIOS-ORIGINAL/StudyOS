import { describe, expect, it } from 'vitest'
import {
  applyTopicRules, emptyChapterDraft, emptyTopicDraft, hasDuplicateName, isValidDateString,
  normName, validateChapterDraft, validateSubjectDraft, validateTopicDraft,
} from './rules'

describe('names', () => {
  it('normalises and detects duplicates case-insensitively', () => {
    expect(normName('  Newton’s   Laws ')).toBe('newton’s laws')
    const sibs = [{ id: '1', name: 'Algebra' }]
    expect(hasDuplicateName(' algebra ', sibs)).toBe(true)
    expect(hasDuplicateName('Algebra', sibs, '1')).toBe(false)
    expect(hasDuplicateName('Geometry', sibs)).toBe(false)
  })
})

describe('validation', () => {
  it('validates subjects', () => {
    expect(validateSubjectDraft({ name: 'Math', color: '#4f46e5' })).toEqual([])
    expect(validateSubjectDraft({ name: ' ', color: 'red' }).length).toBe(2)
  })
  it('validates chapters, allowing unknown weight and hours', () => {
    expect(validateChapterDraft({ ...emptyChapterDraft(), name: 'C1' })).toEqual([])
    expect(validateChapterDraft({ ...emptyChapterDraft(), name: 'C1', weight: 0 })).not.toEqual([])
    expect(validateChapterDraft({ ...emptyChapterDraft(), name: 'C1', weight: NaN })).not.toEqual([])
    expect(validateChapterDraft({ ...emptyChapterDraft(), name: 'C1', targetDate: '2026-02-31' })).not.toEqual([])
    expect(validateChapterDraft({ ...emptyChapterDraft(), name: 'C1', targetDate: '2026-03-01' })).toEqual([])
  })
  it('validates topics', () => {
    expect(validateTopicDraft({ ...emptyTopicDraft(), name: 'T' })).toEqual([])
    expect(validateTopicDraft({ ...emptyTopicDraft(), name: 'T', contentPercent: 101 })).not.toEqual([])
    expect(validateTopicDraft({ ...emptyTopicDraft(), name: 'T', contentPercent: NaN })).not.toEqual([])
    expect(validateTopicDraft({ ...emptyTopicDraft(), name: 'T', difficulty: 6 })).not.toEqual([])
  })
  it('checks date strings strictly', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('26-1-1')).toBe(false)
  })
})

describe('applyTopicRules', () => {
  it('completed means 100% and records the date once', () => {
    const a = applyTopicRules({ status: 'completed', contentPercent: 40 }, 'learning', null, 100)
    expect(a).toEqual({ status: 'completed', contentPercent: 100, completedAt: 100 })
    const b = applyTopicRules({ status: 'completed', contentPercent: 100 }, 'completed', 100, 999)
    expect(b.completedAt).toBe(100)
  })
  it('lowering the percent of a completed topic returns it to learning', () => {
    const r = applyTopicRules({ status: 'completed', contentPercent: 60 }, 'completed', 100, 200)
    expect(r).toEqual({ status: 'learning', contentPercent: 60, completedAt: null })
  })
  it('not started means 0% and clears the date', () => {
    expect(applyTopicRules({ status: 'not-started', contentPercent: 30 }, 'completed', 100, 5))
      .toEqual({ status: 'not-started', contentPercent: 0, completedAt: null })
  })
  it('keeps partial progress for other statuses', () => {
    expect(applyTopicRules({ status: 'practising', contentPercent: 70 }, null, null, 1).contentPercent).toBe(70)
  })
})
