import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createProfile, db, deleteProfile, getActiveProfileId,
  saveProfileSettings, setActiveProfile, updateProfile,
} from './db'
import { DEFAULT_SETTINGS } from '../domain/settings'
import { emptyProfileDraft } from '../domain/profile'

const draft = (name: string) => ({ ...emptyProfileDraft(), displayName: name })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('profiles', () => {
  it('creates profiles with unique ids and activates the newest', async () => {
    const a = await createProfile(draft('A'))
    const b = await createProfile(draft('B'))
    expect(a).not.toBe(b)
    expect(await db.profiles.count()).toBe(2)
    expect(await getActiveProfileId()).toBe(b)
  })

  it('switches the active profile and rejects unknown ids', async () => {
    const a = await createProfile(draft('A'))
    await createProfile(draft('B'))
    await setActiveProfile(a)
    expect(await getActiveProfileId()).toBe(a)
    await expect(setActiveProfile('missing')).rejects.toThrow()
    expect(await getActiveProfileId()).toBe(a)
  })

  it('edits a profile', async () => {
    const a = await createProfile(draft('A'))
    await updateProfile(a, { ...draft('A'), nickname: 'Al' })
    expect((await db.profiles.get(a))?.nickname).toBe('Al')
    await expect(updateProfile('missing', draft('X'))).rejects.toThrow()
  })

  it('keeps settings isolated between profiles', async () => {
    const a = await createProfile(draft('A'))
    const b = await createProfile(draft('B'))
    await saveProfileSettings(a, { ...DEFAULT_SETTINGS, dailyTargetMinutes: 60 })
    expect((await db.profileSettings.get(a))?.dailyTargetMinutes).toBe(60)
    expect((await db.profileSettings.get(b))?.dailyTargetMinutes).toBe(DEFAULT_SETTINGS.dailyTargetMinutes)
  })

  it('deletes only that profile and falls back to another active profile', async () => {
    const a = await createProfile(draft('A'))
    const b = await createProfile(draft('B'))
    await deleteProfile(b)
    expect(await db.profiles.get(b)).toBeUndefined()
    expect(await db.profileSettings.get(b)).toBeUndefined()
    expect(await db.profileSettings.get(a)).toBeDefined()
    expect(await getActiveProfileId()).toBe(a)
  })

  it('clears the active profile when the last one is deleted', async () => {
    const a = await createProfile(draft('A'))
    await deleteProfile(a)
    expect(await db.profiles.count()).toBe(0)
    expect(await getActiveProfileId()).toBeNull()
  })
})
