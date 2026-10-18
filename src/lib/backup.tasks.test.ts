import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db } from './db'
import { buildBackup, restoreBackup } from './backup'
import { validateBackup, type BackupFile } from '../domain/backup/format'
import { defaultPlan } from '../domain/backup/plan'
import { emptyChapterDraft } from '../domain/syllabus/rules'
import { emptyTaskDraft } from '../domain/tasks/rules'
import { emptyProfileDraft } from '../domain/profile'
import { createChapter, createSubject } from './syllabusRepo'
import { createTask, setTaskDone } from './taskRepo'

const wipe = async () => { await db.delete(); await db.open() }
const roundTrip = (b: BackupFile): BackupFile => {
  const v = validateBackup(JSON.parse(JSON.stringify(b)))
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.backup
}
beforeEach(wipe)

async function seed() {
  const p = await createProfile({ ...emptyProfileDraft(), displayName: 'A' })
  const s = await createSubject(p, { name: 'Math', color: '#4f46e5' })
  const c = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Algebra' })
  const linked = await createTask(p, { ...emptyTaskDraft(), title: 'Linked', subjectId: s, chapterId: c, dueDate: '2026-10-20', plannedMinutes: 30 })
  const plain = await createTask(p, { ...emptyTaskDraft(), title: 'Plain' })
  await setTaskDone(p, plain, true)
  return { p, s, c, linked, plain }
}

describe('tasks in backups', () => {
  it('restores every task unchanged, including completion state', async () => {
    const { p } = await seed()
    const before = (await db.tasks.toArray()).sort((x, y) => x.id.localeCompare(y.id))
    const backup = roundTrip(await buildBackup({ kind: 'all' }))
    await wipe()
    await restoreBackup(backup, defaultPlan(backup, new Set()))
    expect((await db.tasks.where('profileId').equals(p).toArray()).sort((x, y) => x.id.localeCompare(y.id))).toEqual(before)
  })
  it('restoring as a copy remaps ids and keeps links pointing inside the copy', async () => {
    const { p, linked } = await seed()
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: p }))
    await restoreBackup(backup, { actions: { [p]: { type: 'create' } }, policy: 'keep-existing' })
    const copyId = (await db.profiles.toArray()).find((x) => x.id !== p)!.id
    const copyTasks = await db.tasks.where('profileId').equals(copyId).toArray()
    const copyLinked = copyTasks.find((t) => t.title === 'Linked')!
    expect(copyTasks).toHaveLength(2)
    expect(copyLinked.id).not.toBe(linked)
    expect((await db.chapters.get(copyLinked.chapterId!))?.profileId).toBe(copyId)
    expect((await db.subjects.get(copyLinked.subjectId!))?.profileId).toBe(copyId)
    expect((await db.tasks.get(linked))?.profileId).toBe(p)
  })
  it('rejects a task that points at a missing chapter or has bad values', async () => {
    const { p } = await seed()
    const bad = await buildBackup({ kind: 'profile', id: p })
    bad.profiles[0].tables.tasks.find((t) => t.title === 'Linked')!.chapterId = 'ghost'
    expect(validateBackup(JSON.parse(JSON.stringify(bad))).ok).toBe(false)
    const bad2 = await buildBackup({ kind: 'profile', id: p })
    bad2.profiles[0].tables.tasks[0].priority = 'urgent'
    expect(validateBackup(JSON.parse(JSON.stringify(bad2))).ok).toBe(false)
  })
  it('counts tasks in the backup summary', async () => {
    const { p } = await seed()
    const v = validateBackup(JSON.parse(JSON.stringify(await buildBackup({ kind: 'profile', id: p }))))
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.summary.profiles[0].counts.tasks).toBe(2)
  })
})
