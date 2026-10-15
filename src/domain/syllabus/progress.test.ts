import { describe, expect, it } from 'vitest'
import type { Chapter, Topic } from './types'
import {
  chapterMinutes, formatPercent, meanProgress, remainingContentMinutes, topicValue, weightedProgress,
} from './progress'

const ch = (id: string, weight: number | null, minutes: number | null = null): Chapter => ({
  id, profileId: 'p', subjectId: 's', name: id, order: 0, weight, estimatedMinutes: minutes,
  targetDate: null, notes: '', createdAt: 0, updatedAt: 0,
})
const tp = (id: string, chapterId: string, pct: number, o: Partial<Topic> = {}): Topic => ({
  id, profileId: 'p', chapterId, name: id, order: 0, status: 'learning', contentPercent: pct,
  practised: false, revised: false, difficulty: null, importance: null, estimatedMinutes: null,
  completedAt: null, notes: '', createdAt: 0, updatedAt: 0, ...o,
})

describe('topic-count progress', () => {
  it('averages topics equally and separates the three dimensions', () => {
    const ts = [tp('a', 'c', 100, { practised: true }), tp('b', 'c', 50), tp('c2', 'c', 0)]
    expect(meanProgress(ts, 'content')).toBeCloseTo(0.5)
    expect(meanProgress(ts, 'practice')).toBeCloseTo(1 / 3)
    expect(meanProgress(ts, 'revision')).toBe(0)
    expect(topicValue(ts[0], 'practice')).toBe(1)
  })
  it('is null without topics (not 0%)', () => {
    expect(meanProgress([], 'content')).toBeNull()
    expect(formatPercent(null)).toBe('n/a')
    expect(formatPercent(0.456)).toBe('46%')
  })
})

describe('weighted progress', () => {
  const chapters = [ch('A', 3), ch('B', 1)]
  const topics = [tp('a1', 'A', 100), tp('b1', 'B', 0), tp('b2', 'B', 0), tp('b3', 'B', 0)]
  it('differs from topic count when weights differ', () => {
    expect(meanProgress(topics, 'content')).toBeCloseTo(0.25)
    expect(weightedProgress(chapters, topics, 'content', 'weight').value).toBeCloseTo(0.75)
  })
  it('treats unset weights as 1 and skips chapters without topics', () => {
    const r = weightedProgress([ch('A', null), ch('B', null), ch('Empty', 5)], [tp('a', 'A', 100), tp('b', 'B', 0)], 'content', 'weight')
    expect(r.value).toBeCloseTo(0.5)
    expect(r.included).toBe(2)
    expect(r.excluded).toBe(1)
  })
  it('uses estimated hours and never guesses missing ones', () => {
    const cs = [ch('A', null, 60), ch('B', null, 120), ch('C', null, null)]
    const ts = [tp('a', 'A', 100), tp('b', 'B', 0), tp('c', 'C', 100)]
    const r = weightedProgress(cs, ts, 'content', 'hours')
    expect(r.value).toBeCloseTo(60 / 180)
    expect(r.excluded).toBe(1)
  })
  it('is null when nothing can be weighted', () => {
    expect(weightedProgress([ch('A', null)], [tp('a', 'A', 50)], 'content', 'hours').value).toBeNull()
  })
})

describe('time estimates', () => {
  it('prefers the chapter estimate, else sums known topic estimates', () => {
    expect(chapterMinutes({ estimatedMinutes: 90 }, [{ estimatedMinutes: 10 }])).toBe(90)
    expect(chapterMinutes({ estimatedMinutes: null }, [{ estimatedMinutes: 10 }, { estimatedMinutes: null }, { estimatedMinutes: 20 }])).toBe(30)
    expect(chapterMinutes({ estimatedMinutes: null }, [{ estimatedMinutes: null }])).toBeNull()
  })
  it('computes remaining time and counts topics without estimates', () => {
    const r = remainingContentMinutes([
      { estimatedMinutes: 60, contentPercent: 50 },
      { estimatedMinutes: 30, contentPercent: 0 },
      { estimatedMinutes: null, contentPercent: 0 },
    ])
    expect(r).toEqual({ minutes: 60, withoutEstimate: 1 })
  })
})
