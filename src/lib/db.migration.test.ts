import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('migrates existing v1 settings into a default profile without losing the old row', async () => {
  const old = new Dexie('studyos')
  old.version(1).stores({ settings: 'id' })
  await old.table('settings').put({
    id: 'main', name: 'Asha', academicYear: '2026-27', boardClass: 'CBSE 10',
    dailyTargetMinutes: 240, preferredDays: [1, 2, 3], weekStart: 1, theme: 'dark',
    focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 20,
    revisionIntervals: [2, 5], gamification: true, onboarded: true, updatedAt: 1,
  })
  old.close()

  const { db, getActiveProfileId } = await import('./db')
  const profiles = await db.profiles.toArray()
  expect(profiles).toHaveLength(1)
  expect(profiles[0].displayName).toBe('Asha')
  expect(await getActiveProfileId()).toBe(profiles[0].id)

  const s = await db.profileSettings.get(profiles[0].id)
  expect(s?.theme).toBe('dark')
  expect(s?.dailyTargetMinutes).toBe(240)
  expect(s?.weeklyTargetMinutes).toBe(720)
  expect(s?.revisionIntervals).toEqual([2, 5])
  expect(await db.settings.get('main')).toBeDefined()
})
