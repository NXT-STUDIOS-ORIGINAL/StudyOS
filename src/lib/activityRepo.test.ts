import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db, deleteProfile } from './db'
import { createChapter, createSubject, deleteChapter, deleteSubject } from './syllabusRepo'
import {
  copyActivityTypes, createActivityType, deleteActivityType, moveActivityType, setActivityStatus, updateActivityType,
} from './activityRepo'
import { buildSlots, dedupeRecords, tally } from '../domain/activity/progress'
import { emptyChapterDraft } from '../domain/syllabus/rules'
import { emptyProfileDraft } from '../domain/profile'

beforeEach(async () => { await db.delete(); await db.open() })

async function setup(name = 'A') {
  const p = await createProfile({ ...emptyProfileDraft(), displayName: name })
  const s = await createSubject(p, { name: 'Math', color: '#4f46e5' })
  const c = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Trig' })
  const types = await db.activityTypes.where('subjectId').equals(s).toArray()
  const t = (n: string) => types.find((x) => x.name === n)!.id
  return { p, s, c, t }
}
const status = async (c: string, typeId: string) =>
  (await db.activityRecords.where('[chapterId+activityTypeId]').equals([c, typeId]).first())?.status ?? 'todo'

describe('defaults and customisation', () => {
  it('seeds a default set per profile and copies it into new subjects', async () => {
    const { p, s } = await setup()
    expect(await db.activityTypes.where('profileId').equals(p).filter((x) => x.subjectId === null).count()).toBe(10)
    expect(await db.activityTypes.where('subjectId').equals(s).count()).toBe(10)
  })
  it('lets one subject drop Theory without touching another subject', async () => {
    const { p, s, c, t } = await setup()
    const s2 = await createSubject(p, { name: 'Science', color: '#0f766e' })
    await setActivityStatus(p, c, t('Theory'), 'done')
    await deleteActivityType(p, t('Theory'))
    expect(await db.activityTypes.where('subjectId').equals(s).count()).toBe(9)
    expect(await db.activityTypes.where('subjectId').equals(s2).count()).toBe(10)
    expect(await db.activityRecords.count()).toBe(0)
  })
  it('keeps records when an activity is only disabled, and excludes it from progress', async () => {
    const { p, s, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    const theory = (await db.activityTypes.get(t('Theory')))!
    await updateActivityType(p, theory.id, { name: theory.name, enabled: false, weight: theory.weight, role: theory.role })
    expect(await db.activityRecords.count()).toBe(1)
    const types = await db.activityTypes.where('subjectId').equals(s).toArray()
    const chapters = await db.chapters.toArray()
    const slots = buildSlots(types, chapters, await db.activityRecords.toArray())
    expect(slots).toHaveLength(9)
  })
  it('rejects duplicate names in one list, allows adding custom activities, and reorders', async () => {
    const { p, s, t } = await setup()
    await expect(createActivityType(p, s, { name: ' theory ', enabled: true, weight: null, role: 'study' })).rejects.toThrow(/already exists/)
    const id = await createActivityType(p, s, { name: 'Diagrams', enabled: true, weight: 1, role: 'practice' })
    expect((await db.activityTypes.get(id))?.order).toBe(10)
    await moveActivityType(p, id, -1)
    expect((await db.activityTypes.get(id))?.order).toBe(9)
    await moveActivityType(p, t('Theory'), -1) // already first: no-op
    expect((await db.activityTypes.get(t('Theory')))?.order).toBe(0)
  })
  it('copies only the missing activities between lists', async () => {
    const { p, s, t } = await setup()
    await deleteActivityType(p, t('Notes'))
    expect(await copyActivityTypes(p, null, s)).toBe(1)
    expect(await copyActivityTypes(p, null, s)).toBe(0)
  })
})

describe('independent ticking', () => {
  it('Theory does not complete Question Practice, and Revision 1 does not complete Revision 2', async () => {
    const { p, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    expect(await status(c, t('Question Practice'))).toBe('todo')
    await setActivityStatus(p, c, t('Revision 1'), 'done')
    expect(await status(c, t('Revision 2'))).toBe('todo')
    expect(await status(c, t('PYQs'))).toBe('todo')
  })
  it('a self-test does not complete Mistake Correction', async () => {
    const { p, c, t } = await setup()
    await setActivityStatus(p, c, t('Self-Test'), 'done')
    expect(await status(c, t('Mistake Correction'))).toBe('todo')
  })
  it('unticking one activity leaves the others alone and keeps history', async () => {
    const { p, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    await setActivityStatus(p, c, t('Question Practice'), 'done')
    await setActivityStatus(p, c, t('Theory'), 'todo')
    expect(await status(c, t('Theory'))).toBe('todo')
    expect(await status(c, t('Question Practice'))).toBe('done')
    const rec = (await db.activityRecords.where('[chapterId+activityTypeId]').equals([c, t('Theory')]).first())!
    expect(rec.completedAt).toBeNull()
    expect(rec.history.map((h) => `${h.from}>${h.to}`)).toEqual(['todo>done', 'done>todo'])
  })
  it('does nothing for a no-op change and rejects activities from another subject', async () => {
    const { p, s, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'todo')
    expect(await db.activityRecords.count()).toBe(0)
    const s2 = await createSubject(p, { name: 'Science', color: '#0f766e' })
    const foreign = (await db.activityTypes.where('subjectId').equals(s2).first())!
    await expect(setActivityStatus(p, c, foreign.id, 'done')).rejects.toThrow(/not part of/)
    expect(s).toBeTruthy()
  })
  it('excludes not-applicable activities from the totals', async () => {
    const { p, s, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    await setActivityStatus(p, c, t('PYQs'), 'na')
    const types = await db.activityTypes.where('subjectId').equals(s).toArray()
    const slots = buildSlots(types, await db.chapters.toArray(), dedupeRecords(await db.activityRecords.toArray()))
    expect(tally(slots)).toMatchObject({ done: 1, applicable: 9 })
  })
  it('persists after closing and reopening the database', async () => {
    const { p, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    db.close()
    await db.open()
    expect(await status(c, t('Theory'))).toBe('done')
  })
})

describe('isolation and cleanup', () => {
  it('refuses to touch another profile’s activities', async () => {
    const a = await setup('A')
    const b = await createProfile({ ...emptyProfileDraft(), displayName: 'B' })
    await expect(setActivityStatus(b, a.c, a.t('Theory'), 'done')).rejects.toThrow()
    await expect(deleteActivityType(b, a.t('Theory'))).rejects.toThrow()
    await expect(createActivityType(b, a.s, { name: 'X', enabled: true, weight: null, role: 'other' })).rejects.toThrow()
    expect(await db.activityRecords.count()).toBe(0)
  })
  it('removes records with a chapter, a subject or a profile', async () => {
    const a = await setup('A')
    const b = await setup('B')
    await setActivityStatus(a.p, a.c, a.t('Theory'), 'done')
    await setActivityStatus(b.p, b.c, b.t('Theory'), 'done')
    await deleteChapter(a.p, a.c)
    expect(await db.activityRecords.where('profileId').equals(a.p).count()).toBe(0)
    await deleteSubject(a.p, a.s)
    expect(await db.activityTypes.where('subjectId').equals(a.s).count()).toBe(0)
    await deleteProfile(b.p)
    expect(await db.activityRecords.count()).toBe(0)
    expect(await db.activityTypes.where('profileId').equals(b.p).count()).toBe(0)
  })
})
