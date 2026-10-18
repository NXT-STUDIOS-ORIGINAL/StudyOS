import { db } from './db'
import { isValidDateString } from '../domain/syllabus/rules'
import { validateTaskDraft } from '../domain/tasks/rules'
import type { Task, TaskDraft } from '../domain/tasks/types'

function rw<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', [db.profiles, db.subjects, db.chapters, db.tasks], fn)
}
function check(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join(' '))
}

async function checkLinks(profileId: string, subjectId: string | null, chapterId: string | null) {
  if (subjectId !== null) {
    const s = await db.subjects.get(subjectId)
    if (!s || s.profileId !== profileId) throw new Error('That subject was not found.')
  }
  if (chapterId !== null) {
    const c = await db.chapters.get(chapterId)
    if (!c || c.profileId !== profileId) throw new Error('That chapter was not found.')
    if (c.subjectId !== subjectId) throw new Error('That chapter belongs to a different subject.')
  }
}

async function ownedTask(profileId: string, id: string): Promise<Task> {
  const t = await db.tasks.get(id)
  if (!t || t.profileId !== profileId) throw new Error('That task was not found.')
  return t
}

const clean = (d: TaskDraft): TaskDraft => ({ ...d, title: d.title.trim() })

export async function createTask(profileId: string, draft: TaskDraft): Promise<string> {
  const d = clean(draft)
  check(validateTaskDraft(d))
  return rw(async () => {
    if (!(await db.profiles.get(profileId))) throw new Error('That profile no longer exists.')
    await checkLinks(profileId, d.subjectId, d.chapterId)
    const id = crypto.randomUUID()
    const now = Date.now()
    await db.tasks.add({ ...d, id, profileId, status: 'todo', completedAt: null, createdAt: now, updatedAt: now })
    return id
  })
}

export async function updateTask(profileId: string, id: string, draft: TaskDraft): Promise<void> {
  const d = clean(draft)
  check(validateTaskDraft(d))
  await rw(async () => {
    const cur = await ownedTask(profileId, id)
    await checkLinks(profileId, d.subjectId, d.chapterId)
    await db.tasks.put({ ...cur, ...d, updatedAt: Math.max(Date.now(), cur.updatedAt + 1) })
  })
}

export async function deleteTask(profileId: string, id: string): Promise<void> {
  await rw(async () => {
    await ownedTask(profileId, id)
    await db.tasks.delete(id)
  })
}

/** Everything needed to undo one change exactly. */
export interface TaskChange { id: string; previous: Task; writtenAt: number }

/** Completing records the time once. Repeating the same change does nothing and returns null. */
export async function setTaskDone(profileId: string, id: string, done: boolean): Promise<TaskChange | null> {
  return rw(async () => {
    const cur = await ownedTask(profileId, id)
    if ((cur.status === 'done') === done) return null
    const now = Math.max(Date.now(), cur.updatedAt + 1)
    await db.tasks.put({
      ...cur, status: done ? 'done' : 'todo', completedAt: done ? now : null, updatedAt: now,
    })
    return { id, previous: cur, writtenAt: now }
  })
}

/** Restores the exact previous task, but only if nothing has changed it since. */
export async function undoTaskChange(profileId: string, change: TaskChange): Promise<boolean> {
  return rw(async () => {
    const cur = await ownedTask(profileId, change.id)
    if (cur.updatedAt !== change.writtenAt) return false
    await db.tasks.put(change.previous)
    return true
  })
}

/** Moves unfinished tasks to a new due date. Finished tasks are skipped. Returns how many moved. */
export async function rescheduleTasks(profileId: string, ids: string[], toDate: string): Promise<number> {
  if (!isValidDateString(toDate)) throw new Error('That date is not valid.')
  return rw(async () => {
    let moved = 0
    for (const id of new Set(ids)) {
      const t = await ownedTask(profileId, id)
      if (t.status !== 'todo' || t.dueDate === toDate) continue
      await db.tasks.put({
        ...t,
        dueDate: toDate,
        startDate: t.startDate !== null && t.startDate > toDate ? null : t.startDate,
        updatedAt: Math.max(Date.now(), t.updatedAt + 1),
      })
      moved++
    }
    return moved
  })
}
