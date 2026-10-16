import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { PROFILE_OWNED_TABLES, createProfile, db, getActiveProfileId, saveProfileSettings } from './db'
import { buildBackup, restoreBackup } from './backup'
import { BACKUP_TABLES, validateBackup, type BackupFile } from '../domain/backup/format'
import { defaultPlan, type ConflictPolicy, type RestorePlan } from '../domain/backup/plan'
import { DEFAULT_SETTINGS } from '../domain/settings'
import { emptyProfileDraft } from '../domain/profile'

const draft = (n: string) => ({ ...emptyProfileDraft(), displayName: n })
const withDaily = (m: number) => ({ ...DEFAULT_SETTINGS, dailyTargetMinutes: m })
const wipe = async () => { await db.delete(); await db.open() }
const ids = async () => new Set((await db.profiles.toArray()).map((p) => p.id))
const roundTrip = (b: BackupFile): BackupFile => {
  const v = validateBackup(JSON.parse(JSON.stringify(b)))
  if (!v.ok) throw new Error(v.errors.join('; '))
  return v.backup
}
const mergePlan = (id: string, policy: ConflictPolicy): RestorePlan =>
  ({ actions: { [id]: { type: 'merge', targetId: id } }, policy })

beforeEach(wipe)

it('keeps the backup table registry in sync with profile-owned tables', () => {
  expect(BACKUP_TABLES.map((t) => t.name)).toEqual([...PROFILE_OWNED_TABLES])
})

describe('export', () => {
  it('exports one profile or all profiles', async () => {
    const a = await createProfile(draft('A'))
    const b = await createProfile(draft('B'))
    const one = await buildBackup({ kind: 'profile', id: a })
    expect(one.scope).toBe('profile')
    expect(one.profiles).toHaveLength(1)
    expect(one.profiles[0].profile.id).toBe(a)
    expect(one.profiles[0].tables.profileSettings).toHaveLength(1)
    const all = await buildBackup({ kind: 'all' })
    expect(all.scope).toBe('all')
    expect(all.profiles.map((p) => p.profile.id).sort()).toEqual([a, b].sort())
  })
  it('refuses to export a missing profile', async () => {
    await expect(buildBackup({ kind: 'profile', id: 'nope' })).rejects.toThrow()
  })
})

describe('restore', () => {
  it('restores all profiles into a clean database without loss or duplication', async () => {
    await createProfile(draft('A'), withDaily(60))
    await createProfile(draft('B'))
    const backup = roundTrip(await buildBackup({ kind: 'all' }))
    const byId = <T extends { id: string }>(x: T, y: T) => x.id.localeCompare(y.id)
    const profilesBefore = (await db.profiles.toArray()).sort(byId)
    const settingsBefore = (await db.profileSettings.toArray()).sort((x, y) => x.profileId.localeCompare(y.profileId))

    await wipe()
    const report = await restoreBackup(backup, defaultPlan(backup, new Set()))
    expect(report.created).toBe(2)
    expect((await db.profiles.toArray()).sort(byId)).toEqual(profilesBefore)
    expect((await db.profileSettings.toArray()).sort((x, y) => x.profileId.localeCompare(y.profileId))).toEqual(settingsBefore)
    expect(await getActiveProfileId()).not.toBeNull()
  })

  it('creates a copy with a new id when the backup id already exists', async () => {
    const a = await createProfile(draft('A'), withDaily(60))
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    await restoreBackup(backup, { actions: { [a]: { type: 'create' } }, policy: 'keep-existing' })
    const profiles = await db.profiles.toArray()
    expect(profiles).toHaveLength(2)
    const copy = profiles.find((p) => p.id !== a)
    expect(copy).toBeDefined()
    expect((await db.profileSettings.get(copy!.id))?.profileId).toBe(copy!.id)
    expect(await db.profileSettings.count()).toBe(2)
  })

  it('replaces a different profile with backup data and leaves others alone', async () => {
    const a = await createProfile(draft('A'), withDaily(60))
    const b = await createProfile(draft('B'), withDaily(300))
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    const r = await restoreBackup(backup, { actions: { [a]: { type: 'replace', targetId: b } }, policy: 'keep-existing' })
    expect(r.replaced).toBe(1)
    expect((await db.profiles.get(b))?.displayName).toBe('A')
    expect((await db.profileSettings.get(b))?.dailyTargetMinutes).toBe(60)
    expect((await db.profileSettings.get(b))?.profileId).toBe(b)
    expect(await db.profiles.count()).toBe(2)
    expect(await db.profileSettings.count()).toBe(2)
  })

  describe('merge', () => {
    async function setup() {
      const a = await createProfile(draft('A'), withDaily(60))
      const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
      await saveProfileSettings(a, withDaily(120))
      return { a, backup }
    }
    it('keeps the existing version', async () => {
      const { a, backup } = await setup()
      const r = await restoreBackup(backup, mergePlan(a, 'keep-existing'))
      expect(r.rowsKept).toBe(1)
      expect((await db.profileSettings.get(a))?.dailyTargetMinutes).toBe(120)
    })
    it('uses the backup version', async () => {
      const { a, backup } = await setup()
      const r = await restoreBackup(backup, mergePlan(a, 'use-backup'))
      expect(r.rowsOverwritten).toBe(1)
      expect((await db.profileSettings.get(a))?.dailyTargetMinutes).toBe(60)
    })
    it('newer policy follows updatedAt', async () => {
      const { a, backup } = await setup()
      await restoreBackup(backup, mergePlan(a, 'newer'))
      expect((await db.profileSettings.get(a))?.dailyTargetMinutes).toBe(120)
      backup.profiles[0].tables.profileSettings[0].updatedAt = Date.now() + 100_000
      await restoreBackup(backup, mergePlan(a, 'newer'))
      expect((await db.profileSettings.get(a))?.dailyTargetMinutes).toBe(60)
    })
    it('adds missing records and recognises identical ones', async () => {
      const a = await createProfile(draft('A'))
      const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
      const total = Object.values(backup.profiles[0].tables).reduce((n, rows) => n + rows.length, 0)
      expect((await restoreBackup(backup, mergePlan(a, 'keep-existing'))).rowsIdentical).toBe(total)
      await db.profileSettings.delete(a)
      expect((await restoreBackup(backup, mergePlan(a, 'keep-existing'))).rowsAdded).toBe(1)
      expect(await db.profileSettings.count()).toBe(1)
    })
  })

  it('rolls back everything when the restore fails midway', async () => {
    await createProfile(draft('A'))
    await createProfile(draft('B'))
    const backup = roundTrip(await buildBackup({ kind: 'all' }))
    await wipe()
    const c = await createProfile(draft('C'))
    const plan = defaultPlan(backup, await ids())
    await expect(
      restoreBackup(backup, plan, (done) => { if (done === 1) throw new Error('boom') }),
    ).rejects.toThrow('boom')
    expect((await db.profiles.toArray()).map((p) => p.id)).toEqual([c])
    expect(await db.profileSettings.count()).toBe(1)
  })

  it('rejects an invalid plan without touching the database', async () => {
    const a = await createProfile(draft('A'))
    const backup = roundTrip(await buildBackup({ kind: 'profile', id: a }))
    await expect(
      restoreBackup(backup, { actions: { [a]: { type: 'merge', targetId: 'missing' } }, policy: 'keep-existing' }),
    ).rejects.toThrow()
    expect(await db.profiles.count()).toBe(1)
  })
})
