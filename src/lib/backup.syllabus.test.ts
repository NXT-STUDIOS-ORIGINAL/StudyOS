import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db } from './db'
import { buildBackup, restoreBackup } from './backup'
import { validateBackup, type BackupFile } from '../domain/backup/format'
import { defaultPlan } from '../domain/backup/plan'
import { emptyChapterDraft, emptyTopicDraft } from '../domain/syllabus/rules'
import { emptyProfileDraft } from '../domain/profile'
import { createChapter, createSubject, createTopic } from './syllabusRepo'

const wipe = async () => { await db.delete(); await db.open() }
const roundTrip = (b: BackupFile): BackupFile => {
  const v = validateBackup(JSON.parse(JSON.stringify(b)))
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.backup
}
const byId = <T extends { id: string }>(x: T, y: T) => x.id.localeCompare(y.id)

async function seed(name: string) {
  const p = await createProfile({ ...emptyProfileDraft(), displayName: name })
  const s = await createSubject(p, { name: 'Math', color: '#4f46e5' })
  const c1 = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Algebra', weight: 3 })
  const c2 = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Geometry' })
  await createTopic(p, c1, { ...emptyTopicDraft(), name: 'Equations', status: 'completed' })
  await createTopic(p, c1, { ...emptyTopicDraft(), name: 'Inequalities' })
  await createTopic(p, c2, { ...emptyTopicDraft(), name: 'Triangles', practised: true })
  return p
}
const rowsOf = async (pid: string) => ({
  subjects: (await db.subjects.where('profileId').equals(pid).toArray()).sort(byId),
  chapters: (await db.chapters.where('profileId').equals(pid).toArray()).sort(byId),
  topics: (await db.topics.where('profileId').equals(pid).toArray()).sort(byId),
})
function expectConsistent(r: Awaited<ReturnType<typeof rowsOf>>) {
  expect(r.chapters.every((c) => r.subjects.some((s) => s.id === c.subjectId))).toBe(true)
  expect(r.topics.every((t) => r.chapters.some((c) => c.id === t.chapterId))).toBe(true)
}

beforeEach(wipe)

describe('syllabus in backups', () => {
  it('round-trips into a clean database with identical records', async () => {
    const p = await seed('A')
    const before = await rowsOf(p)
    const backup = roundTrip(await buildBackup({ kind: 'all' }))
    await wipe()
    await restoreBackup(backup, defaultPlan(backup, new Set()))
    expect(await rowsOf(p)).toEqual(before)
  })

  it('restoring as a copy remaps ids and keeps references consistent', async () => {
    const a = await seed('A')
    const original = await rowsOf(a)
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    await restoreBackup(backup, { actions: { [a]: { type: 'create' } }, policy: 'keep-existing' })
    const copyId = (await db.profiles.toArray()).find((p) => p.id !== a)!.id
    const copy = await rowsOf(copyId)
    expect(copy.subjects).toHaveLength(1)
    expect(copy.chapters).toHaveLength(2)
    expect(copy.topics).toHaveLength(3)
    expectConsistent(copy)
    const oldIds = new Set([...original.subjects, ...original.chapters, ...original.topics].map((r) => r.id))
    expect([...copy.subjects, ...copy.chapters, ...copy.topics].every((r) => !oldIds.has(r.id))).toBe(true)
    expect(await rowsOf(a)).toEqual(original)
  })

  it('replacing another profile imports a consistent copy and leaves the source alone', async () => {
    const a = await seed('A')
    const b = await createProfile({ ...emptyProfileDraft(), displayName: 'B' })
    const sb = await createSubject(b, { name: 'Old', color: '#0f766e' })
    await createChapter(b, sb, { ...emptyChapterDraft(), name: 'Gone' })
    const original = await rowsOf(a)
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    await restoreBackup(backup, { actions: { [a]: { type: 'replace', targetId: b } }, policy: 'keep-existing' })
    const replaced = await rowsOf(b)
    expect(replaced.subjects.map((s) => s.name)).toEqual(['Math'])
    expect(replaced.chapters).toHaveLength(2)
    expect(replaced.topics).toHaveLength(3)
    expectConsistent(replaced)
    expect(await rowsOf(a)).toEqual(original)
  })

  it('merge adds missing topics and keeps existing records', async () => {
    const a = await seed('A')
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    const lost = (await db.topics.toArray()).find((t) => t.name === 'Triangles')!
    await db.topics.delete(lost.id)
    const r = await restoreBackup(backup, { actions: { [a]: { type: 'merge', targetId: a } }, policy: 'keep-existing' })
    expect(r.rowsAdded).toBe(1)
    expect(await db.topics.where('profileId').equals(a).count()).toBe(3)
    expect(r.rowsIdentical).toBeGreaterThan(0)
  })

  it('rejects a backup whose topic points at a missing chapter', async () => {
    const a = await seed('A')
    const backup = await buildBackup({ kind: 'profile', id: a })
    backup.profiles[0].tables.topics[0].chapterId = 'ghost'
    const v = validateBackup(JSON.parse(JSON.stringify(backup)))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.join(' ')).toMatch(/missing record in chapters/)
  })

  it('exports syllabus counts in the summary', async () => {
    const a = await seed('A')
    const v = validateBackup(JSON.parse(JSON.stringify(await buildBackup({ kind: 'profile', id: a }))))
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.summary.profiles[0].counts).toMatchObject({ subjects: 1, chapters: 2, topics: 3 })
  })
})
