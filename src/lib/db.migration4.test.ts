import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('adds activities to existing syllabus data and converts the old topic flags', async () => {
  const old = new Dexie('studyos')
  old.version(1).stores({ settings: 'id' })
  old.version(2).stores({ settings: 'id', profiles: 'id, lastActiveAt', profileSettings: 'profileId', appState: 'key' })
  old.version(3).stores({ subjects: 'id, profileId', chapters: 'id, profileId, subjectId', topics: 'id, profileId, chapterId' })
  const base = { profileId: 'p1', order: 0, createdAt: 1, updatedAt: 1 }
  await old.table('profiles').add({
    id: 'p1', displayName: 'A', nickname: '', board: '', classGrade: '', academicYear: '', schoolName: '',
    avatar: { kind: 'default', key: 'indigo' }, createdAt: 1, lastActiveAt: 1,
  })
  await old.table('subjects').add({ id: 's1', ...base, name: 'Math', color: '#4f46e5' })
  await old.table('chapters').add({
    id: 'c1', ...base, subjectId: 's1', name: 'Algebra', weight: null, estimatedMinutes: null, targetDate: null, notes: '',
  })
  const topic = { ...base, chapterId: 'c1', status: 'learning', contentPercent: 50, difficulty: null, importance: null, estimatedMinutes: null, completedAt: null, notes: '' }
  await old.table('topics').bulkAdd([
    { id: 't1', name: 'T1', ...topic, practised: true, revised: true },
    { id: 't2', name: 'T2', ...topic, practised: true, revised: false },
  ])
  old.close()

  const { db } = await import('./db')
  const types = await db.activityTypes.toArray()
  expect(types.filter((t) => t.subjectId === null)).toHaveLength(10)
  expect(types.filter((t) => t.subjectId === 's1')).toHaveLength(10)

  const records = await db.activityRecords.toArray()
  const practice = types.find((t) => t.subjectId === 's1' && t.name === 'Question Practice')!
  const rev1 = types.find((t) => t.subjectId === 's1' && t.name === 'Revision 1')!
  expect(records.find((r) => r.activityTypeId === practice.id)?.status).toBe('done')
  const partial = records.find((r) => r.activityTypeId === rev1.id)!
  expect(partial.status).toBe('todo')
  expect(partial.notes).toMatch(/1 of 2/)
  expect(await db.topics.count()).toBe(2)
  expect(await db.subjects.count()).toBe(1)
})
