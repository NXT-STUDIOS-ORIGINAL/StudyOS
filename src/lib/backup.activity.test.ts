import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db } from './db'
import { buildBackup, restoreBackup } from './backup'
import { validateBackup, type BackupFile } from '../domain/backup/format'
import { defaultPlan } from '../domain/backup/plan'
import { emptyChapterDraft } from '../domain/syllabus/rules'
import { emptyProfileDraft } from '../domain/profile'
import { createChapter, createSubject } from './syllabusRepo'
import { setActivityStatus } from './activityRepo'

const wipe = async () => { await db.delete(); await db.open() }
const roundTrip = (b: BackupFile): BackupFile => {
  const v = validateBackup(JSON.parse(JSON.stringify(b)))
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.backup
}
const byId = <T extends { id: string }>(x: T, y: T) => x.id.localeCompare(y.id)

async function seed() {
  const p = await createProfile({ ...emptyProfileDraft(), displayName: 'A' })
  const s = await createSubject(p, { name: 'Math', color: '#4f46e5' })
  const c1 = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Algebra' })
  const c2 = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Geometry' })
  const types = await db.activityTypes.where('subjectId').equals(s).toArray()
  const t = (n: string) => types.find((x) => x.name === n)!.id
  await setActivityStatus(p, c1, t('Theory'), 'done')
  await setActivityStatus(p, c1, t('Question Practice'), 'done')
  await setActivityStatus(p, c1, t('Question Practice'), 'todo') // creates history
  await setActivityStatus(p, c2, t('PYQs'), 'na')
  return { p, s, c1, c2, t }
}
const activityRows = async (pid: string) => ({
  types: (await db.activityTypes.where('profileId').equals(pid).toArray()).sort(byId),
  records: (await db.activityRecords.where('profileId').equals(pid).toArray()).sort(byId),
})

beforeEach(wipe)

describe('activities in backups', () => {
  it('preserves every state, date and history entry through export and restore', async () => {
    const { p } = await seed()
    const before = await activityRows(p)
    const backup = roundTrip(await buildBackup({ kind: 'all' }))
    await wipe()
    await restoreBackup(backup, defaultPlan(backup, new Set()))
    expect(await activityRows(p)).toEqual(before)
    expect(before.records.some((r) => r.history.length === 3 || r.history.length === 2)).toBe(true)
  })

  it('restores a copy with remapped ids and consistent references', async () => {
    const { p } = await seed()
    const original = await activityRows(p)
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: p }))
    await restoreBackup(backup, { actions: { [p]: { type: 'create' } }, policy: 'keep-existing' })
    const copyId = (await db.profiles.toArray()).find((x) => x.id !== p)!.id
    const copy = await activityRows(copyId)
    expect(copy.types).toHaveLength(original.types.length)
    expect(copy.records).toHaveLength(original.records.length)
    const chapters = await db.chapters.where('profileId').equals(copyId).toArray()
    expect(copy.records.every((r) => chapters.some((c) => c.id === r.chapterId) && copy.types.some((t) => t.id === r.activityTypeId))).toBe(true)
    expect(copy.records.map((r) => r.status).sort()).toEqual(original.records.map((r) => r.status).sort())
    expect(await activityRows(p)).toEqual(original)
  })

  it('merges by stable id and follows the conflict policy', async () => {
    const { p, c1, t } = await seed()
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: p }))
    await setActivityStatus(p, c1, t('Theory'), 'todo')
    const plan = (policy: 'keep-existing' | 'use-backup') => ({ actions: { [p]: { type: 'merge' as const, targetId: p } }, policy })
    await restoreBackup(backup, plan('keep-existing'))
    expect((await db.activityRecords.where('[chapterId+activityTypeId]').equals([c1, t('Theory')]).first())?.status).toBe('todo')
    await restoreBackup(backup, plan('use-backup'))
    expect((await db.activityRecords.where('[chapterId+activityTypeId]').equals([c1, t('Theory')]).first())?.status).toBe('done')
    expect(await db.activityRecords.count()).toBe(backup.profiles[0].tables.activityRecords.length)
  })

  it('rejects duplicate records for the same chapter and activity', async () => {
    const { p } = await seed()
    const backup = await buildBackup({ kind: 'profile', id: p })
    const rows = backup.profiles[0].tables.activityRecords
    rows.push({ ...rows[0], id: 'another-id' })
    const v = validateBackup(JSON.parse(JSON.stringify(backup)))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.join(' ')).toMatch(/Duplicate activity record/)
  })

  it('rejects records that point at a missing activity or chapter', async () => {
    const { p } = await seed()
    const backup = await buildBackup({ kind: 'profile', id: p })
    backup.profiles[0].tables.activityRecords[0].activityTypeId = 'ghost'
    const v = validateBackup(JSON.parse(JSON.stringify(backup)))
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.errors.join(' ')).toMatch(/missing record in activityTypes/)
  })

  it('accepts the default set (no subject) and counts activity data in the summary', async () => {
    const { p } = await seed()
    const v = validateBackup(JSON.parse(JSON.stringify(await buildBackup({ kind: 'profile', id: p }))))
    expect(v.ok).toBe(true)
    if (v.ok) {
      expect(v.summary.profiles[0].counts.activityTypes).toBe(20)
      expect(v.summary.profiles[0].counts.activityRecords).toBeGreaterThan(0)
    }
  })
})
