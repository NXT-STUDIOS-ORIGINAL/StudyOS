import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db, deleteProfile } from './db'
import { createChapter, createSubject, deleteChapter, deleteSubject } from './syllabusRepo'
import {
  createTask, deleteTask, rescheduleTasks, setTaskDone, undoTaskChange, updateTask,
} from './taskRepo'
import { emptyChapterDraft } from '../domain/syllabus/rules'
import { emptyTaskDraft } from '../domain/tasks/rules'
import { emptyProfileDraft } from '../domain/profile'

beforeEach(async () => { await db.delete(); await db.open() })
const prof = (n = 'A') => createProfile({ ...emptyProfileDraft(), displayName: n })
const draft = (title: string, o = {}) => ({ ...emptyTaskDraft(), title, ...o })

describe('creating and editing', () => {
  it('creates a task and trims the title', async () => {
    const p = await prof()
    const id = await createTask(p, draft('  Solve 10 questions  ', { dueDate: '2026-10-20' }))
    expect(await db.tasks.get(id)).toMatchObject({ title: 'Solve 10 questions', status: 'todo', profileId: p })
  })
  it('rejects invalid input without writing', async () => {
    const p = await prof()
    await expect(createTask(p, draft('  '))).rejects.toThrow()
    await expect(createTask(p, draft('x', { dueDate: '2026-02-31' }))).rejects.toThrow()
    expect(await db.tasks.count()).toBe(0)
  })
  it('updates fields but keeps status and completion', async () => {
    const p = await prof()
    const id = await createTask(p, draft('A'))
    await setTaskDone(p, id, true)
    await updateTask(p, id, draft('A renamed', { priority: 'high' }))
    expect(await db.tasks.get(id)).toMatchObject({ title: 'A renamed', priority: 'high', status: 'done' })
  })
})

describe('links', () => {
  it('only allows your own subject, and a chapter that belongs to that subject', async () => {
    const a = await prof('A')
    const b = await prof('B')
    const sa = await createSubject(a, { name: 'Math', color: '#4f46e5' })
    const s2 = await createSubject(a, { name: 'Science', color: '#0f766e' })
    const ca = await createChapter(a, sa, { ...emptyChapterDraft(), name: 'Algebra' })
    await expect(createTask(b, draft('x', { subjectId: sa }))).rejects.toThrow()
    await expect(createTask(a, draft('x', { subjectId: s2, chapterId: ca }))).rejects.toThrow(/different subject/)
    await expect(createTask(a, draft('x', { subjectId: sa, chapterId: ca }))).resolves.toBeTruthy()
  })
  it('clears links when a chapter or subject is deleted but keeps the task', async () => {
    const p = await prof()
    const s = await createSubject(p, { name: 'Math', color: '#4f46e5' })
    const c = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Algebra' })
    const t1 = await createTask(p, draft('one', { subjectId: s, chapterId: c }))
    const t2 = await createTask(p, draft('two', { subjectId: s, chapterId: c }))
    await deleteChapter(p, c)
    expect(await db.tasks.get(t1)).toMatchObject({ subjectId: s, chapterId: null })
    await deleteSubject(p, s)
    expect(await db.tasks.get(t2)).toMatchObject({ subjectId: null, chapterId: null })
    expect(await db.tasks.count()).toBe(2)
  })
})

describe('completing and undo', () => {
  it('records the completion time once and ignores repeats', async () => {
    const p = await prof()
    const id = await createTask(p, draft('A'))
    const change = await setTaskDone(p, id, true)
    expect(change).not.toBeNull()
    const done = (await db.tasks.get(id))!
    expect(done.status).toBe('done')
    expect(done.completedAt).not.toBeNull()
    expect(await setTaskDone(p, id, true)).toBeNull()
    expect((await db.tasks.get(id))?.completedAt).toBe(done.completedAt)
  })
  it('handles simultaneous taps as one change', async () => {
    const p = await prof()
    const id = await createTask(p, draft('A'))
    const results = await Promise.all([setTaskDone(p, id, true), setTaskDone(p, id, true)])
    expect(results.filter((r) => r !== null)).toHaveLength(1)
  })
  it('undo restores the exact previous task, and refuses after a later change', async () => {
    const p = await prof()
    const id = await createTask(p, draft('A'))
    const before = (await db.tasks.get(id))!
    const change = (await setTaskDone(p, id, true))!
    expect(await undoTaskChange(p, change)).toBe(true)
    expect(await db.tasks.get(id)).toEqual(before)
    const again = (await setTaskDone(p, id, true))!
    await updateTask(p, id, draft('Edited'))
    expect(await undoTaskChange(p, again)).toBe(false)
    expect((await db.tasks.get(id))?.status).toBe('done')
  })
})

describe('rescheduling', () => {
  it('moves only unfinished tasks and never completes anything', async () => {
    const p = await prof()
    const late = await createTask(p, draft('late', { dueDate: '2026-10-10', startDate: '2026-10-09' }))
    const done = await createTask(p, draft('done', { dueDate: '2026-10-10' }))
    await setTaskDone(p, done, true)
    const moved = await rescheduleTasks(p, [late, done, late], '2026-10-16')
    expect(moved).toBe(1)
    expect(await db.tasks.get(late)).toMatchObject({ dueDate: '2026-10-16', status: 'todo', startDate: '2026-10-09' })
    expect((await db.tasks.get(done))?.dueDate).toBe('2026-10-10')
    await expect(rescheduleTasks(p, [late], '2026-02-31')).rejects.toThrow()
  })
  it('pulls a start date back when it would fall after the new due date', async () => {
    const p = await prof()
    const id = await createTask(p, draft('x', { startDate: '2026-10-20', dueDate: '2026-10-25' }))
    await rescheduleTasks(p, [id], '2026-10-16')
    expect(await db.tasks.get(id)).toMatchObject({ dueDate: '2026-10-16', startDate: null })
  })
})

describe('isolation', () => {
  it('stops other profiles editing, completing, deleting or rescheduling', async () => {
    const a = await prof('A')
    const b = await prof('B')
    const id = await createTask(a, draft('private', { dueDate: '2026-10-10' }))
    await expect(updateTask(b, id, draft('x'))).rejects.toThrow()
    await expect(setTaskDone(b, id, true)).rejects.toThrow()
    await expect(deleteTask(b, id)).rejects.toThrow()
    await expect(rescheduleTasks(b, [id], '2026-10-16')).rejects.toThrow()
    expect(await db.tasks.get(id)).toMatchObject({ title: 'private', status: 'todo' })
  })
  it('deleting a profile removes its tasks only', async () => {
    const a = await prof('A')
    const b = await prof('B')
    await createTask(a, draft('a1'))
    await createTask(b, draft('b1'))
    await deleteProfile(a)
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['b1'])
  })
})
