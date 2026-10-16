import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db, deleteProfile } from './db'
import { createChapter, createSubject } from './syllabusRepo'
import { resetTrackerPrefs, saveTrackerPrefs, setChapterPinned, setSubjectPinned } from './trackerRepo'
import { buildBackup, restoreBackup } from './backup'
import { validateBackup, type BackupFile } from '../domain/backup/format'
import { emptyChapterDraft } from '../domain/syllabus/rules'
import { emptyProfileDraft } from '../domain/profile'

beforeEach(async () => { await db.delete(); await db.open() })
const prof = (n: string) => createProfile({ ...emptyProfileDraft(), displayName: n })
const roundTrip = (b: BackupFile): BackupFile => {
  const v = validateBackup(JSON.parse(JSON.stringify(b)))
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.backup
}

describe('tracker preferences', () => {
  it('start from defaults and merge patches', async () => {
    const p = await prof('A')
    expect(await db.trackerPrefs.get(p)).toBeUndefined()
    await saveTrackerPrefs(p, { view: 'detailed' })
    await saveTrackerPrefs(p, { filter: 'incomplete' })
    expect(await db.trackerPrefs.get(p)).toMatchObject({ view: 'detailed', filter: 'incomplete', lastSubjectId: null })
  })
  it('rejects bad values and subjects from another profile', async () => {
    const a = await prof('A')
    const b = await prof('B')
    const s = await createSubject(b, { name: 'Math', color: '#4f46e5' })
    await expect(saveTrackerPrefs(a, { view: 'huge' as never })).rejects.toThrow()
    await expect(saveTrackerPrefs(a, { filter: 'nope' as never })).rejects.toThrow()
    await expect(saveTrackerPrefs(a, { lastSubjectId: s })).rejects.toThrow()
    await expect(saveTrackerPrefs('missing', { view: 'compact' })).rejects.toThrow()
  })
  it('are separate per profile, resettable, and deleted with the profile', async () => {
    const a = await prof('A')
    const b = await prof('B')
    await saveTrackerPrefs(a, { view: 'detailed' })
    await saveTrackerPrefs(b, { view: 'compact', filter: 'pinned' })
    expect((await db.trackerPrefs.get(a))?.view).toBe('detailed')
    expect((await db.trackerPrefs.get(b))?.filter).toBe('pinned')
    await resetTrackerPrefs(a)
    expect(await db.trackerPrefs.get(a)).toBeUndefined()
    await deleteProfile(b)
    expect(await db.trackerPrefs.count()).toBe(0)
  })
})

describe('pinning', () => {
  it('pins and unpins only your own subjects and chapters', async () => {
    const a = await prof('A')
    const b = await prof('B')
    const s = await createSubject(a, { name: 'Math', color: '#4f46e5' })
    const c = await createChapter(a, s, { ...emptyChapterDraft(), name: 'Algebra' })
    await setSubjectPinned(a, s, true)
    await setChapterPinned(a, c, true)
    expect((await db.subjects.get(s))?.pinned).toBe(true)
    expect((await db.chapters.get(c))?.pinned).toBe(true)
    await expect(setSubjectPinned(b, s, false)).rejects.toThrow()
    await expect(setChapterPinned(b, c, false)).rejects.toThrow()
    await setChapterPinned(a, c, false)
    expect((await db.chapters.get(c))?.pinned).toBe(false)
  })
})

describe('preferences in backups', () => {
  it('round-trips and follows remapped subject ids when restored as a copy', async () => {
    const a = await prof('A')
    const s = await createSubject(a, { name: 'Math', color: '#4f46e5' })
    await setSubjectPinned(a, s, true)
    await saveTrackerPrefs(a, { view: 'detailed', lastSubjectId: s, defaultSubjectId: s })
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    await restoreBackup(backup, { actions: { [a]: { type: 'create' } }, policy: 'keep-existing' })
    const copyId = (await db.profiles.toArray()).find((x) => x.id !== a)!.id
    const prefs = (await db.trackerPrefs.get(copyId))!
    const copySubject = (await db.subjects.where('profileId').equals(copyId).toArray())[0]
    expect(prefs.view).toBe('detailed')
    expect(prefs.lastSubjectId).toBe(copySubject.id)
    expect(prefs.defaultSubjectId).toBe(copySubject.id)
    expect(copySubject.pinned).toBe(true)
    expect((await db.trackerPrefs.get(a))?.lastSubjectId).toBe(s)
  })
  it('accepts a remembered subject that no longer exists', async () => {
    const a = await prof('A')
    const s = await createSubject(a, { name: 'Math', color: '#4f46e5' })
    await saveTrackerPrefs(a, { lastSubjectId: s })
    const backup = await buildBackup({ kind: 'profile', id: a })
    backup.profiles[0].tables.trackerPrefs[0].lastSubjectId = 'deleted-long-ago'
    expect(validateBackup(JSON.parse(JSON.stringify(backup))).ok).toBe(true)
  })
  it('rejects invalid preference records', async () => {
    const a = await prof('A')
    await saveTrackerPrefs(a, { view: 'compact' })
    const backup = await buildBackup({ kind: 'profile', id: a })
    backup.profiles[0].tables.trackerPrefs[0].view = 'huge'
    expect(validateBackup(JSON.parse(JSON.stringify(backup))).ok).toBe(false)
  })
})
