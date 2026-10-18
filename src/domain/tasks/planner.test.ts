import { describe, expect, it } from 'vitest'
import type { Task } from './types'
import { addDaysString, daysFrom, dueLabel, todayString, weekdayOf } from './dates'
import { compareTasks, groupTasks, workloadForDays } from './planner'

const task = (id: string, o: Partial<Task> = {}): Task => ({
  id, profileId: 'p', title: id, notes: '', status: 'todo', priority: 'normal', subjectId: null,
  chapterId: null, plannedMinutes: null, actualMinutes: null, startDate: null, dueDate: null,
  completedAt: null, createdAt: 0, updatedAt: 0, ...o,
})

describe('dates', () => {
  it('handles month and year boundaries and weekdays', () => {
    expect(addDaysString('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysString('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysString('2026-03-01', -1)).toBe('2026-02-28')
    expect(weekdayOf('2026-10-16')).toBe(5)
    expect(daysFrom('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('uses the local calendar date', () => {
    expect(todayString(new Date(2026, 9, 16, 23, 59))).toBe('2026-10-16')
    expect(todayString(new Date(2026, 9, 17, 0, 1))).toBe('2026-10-17')
  })
  it('labels due dates', () => {
    expect(dueLabel(null, '2026-10-16')).toBe('No date')
    expect(dueLabel('2026-10-16', '2026-10-16')).toBe('Today')
    expect(dueLabel('2026-10-17', '2026-10-16')).toBe('Tomorrow')
    expect(dueLabel('2026-10-15', '2026-10-16')).toBe('Overdue by 1 day')
    expect(dueLabel('2026-10-10', '2026-10-16')).toBe('Overdue by 6 days')
  })
})

describe('groupTasks', () => {
  const today = '2026-10-16'
  it('splits by due date and keeps finished tasks apart', () => {
    const g = groupTasks(
      [
        task('late', { dueDate: '2026-10-15' }), task('now', { dueDate: today }),
        task('soon', { dueDate: '2026-10-20' }), task('none'),
        task('finished', { dueDate: '2026-10-01', status: 'done', completedAt: 5 }),
      ],
      today,
    )
    expect(g.overdue.map((t) => t.id)).toEqual(['late'])
    expect(g.today.map((t) => t.id)).toEqual(['now'])
    expect(g.upcoming.map((t) => t.id)).toEqual(['soon'])
    expect(g.undated.map((t) => t.id)).toEqual(['none'])
    expect(g.done.map((t) => t.id)).toEqual(['finished'])
  })
  it('never treats a finished task as overdue', () => {
    const g = groupTasks([task('x', { dueDate: '2020-01-01', status: 'done' })], today)
    expect(g.overdue).toHaveLength(0)
  })
  it('orders by due date, then priority, then age', () => {
    const list = [
      task('c', { dueDate: '2026-10-20', priority: 'low' }),
      task('b', { dueDate: '2026-10-20', priority: 'high' }),
      task('a', { dueDate: '2026-10-18' }),
      task('n'),
    ].sort(compareTasks)
    expect(list.map((t) => t.id)).toEqual(['a', 'b', 'c', 'n'])
  })
})

describe('workloadForDays', () => {
  const dates = ['2026-10-16', '2026-10-17', '2026-10-18']
  const cap = (d: string) => (d === '2026-10-18' ? 0 : 120)
  it('reports free, ok, over and rest days', () => {
    const loads = workloadForDays(
      [
        task('a', { dueDate: '2026-10-16', plannedMinutes: 60 }),
        task('b', { dueDate: '2026-10-17', plannedMinutes: 100 }),
        task('c', { dueDate: '2026-10-17', plannedMinutes: 60 }),
        task('d', { dueDate: '2026-10-18', plannedMinutes: 30 }),
      ],
      dates,
      cap,
    )
    expect(loads.map((l) => l.state)).toEqual(['ok', 'over', 'rest'])
    expect(loads[1].plannedMinutes).toBe(160)
  })
  it('ignores finished tasks, counts unestimated tasks without inventing time', () => {
    const loads = workloadForDays(
      [task('a', { dueDate: '2026-10-16', status: 'done', plannedMinutes: 500 }), task('b', { dueDate: '2026-10-17' })],
      dates,
      cap,
    )
    expect(loads[0].state).toBe('free')
    expect(loads[1]).toMatchObject({ plannedMinutes: 0, unestimated: 1, state: 'ok' })
  })
})
