import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('sets “show on card” for existing activities: built-in names follow the defaults, your own stay visible', async () => {
  const old = new Dexie('studyos')
  old.version(1).stores({ settings: 'id' })
  old.version(2).stores({ settings: 'id', profiles: 'id, lastActiveAt', profileSettings: 'profileId', appState: 'key' })
  old.version(3).stores({ subjects: 'id, profileId', chapters: 'id, profileId, subjectId', topics: 'id, profileId, chapterId' })
  old.version(4).stores({
    activityTypes: 'id, profileId, subjectId',
    activityRecords: 'id, profileId, chapterId, activityTypeId, [chapterId+activityTypeId]',
  })
  const base = { profileId: 'p', subjectId: null, order: 0, enabled: true, weight: 1, role: 'other', createdAt: 1, updatedAt: 1 }
  await old.table('activityTypes').bulkAdd([
    { id: 'a', name: 'Theory', ...base },
    { id: 'b', name: 'Notes', ...base },
    { id: 'c', name: 'Formula Practice', ...base },
    { id: 'd', name: 'Revision 1', ...base },
    { id: 'e', name: 'Revision 2', ...base },
  ])
  old.close()

  const { db } = await import('./db')
  const show = async (id: string) => (await db.activityTypes.get(id))?.showInCompact
  expect(await show('a')).toBe(true)
  expect(await show('b')).toBe(false)
  expect(await show('c')).toBe(true)
  expect(await show('d')).toBe(true)
  expect(await show('e')).toBe(false)
  expect(await db.trackerPrefs.count()).toBe(0)
})
