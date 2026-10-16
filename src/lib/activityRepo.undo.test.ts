import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db } from './db'
import { createChapter, createSubject } from './syllabusRepo'
import { createActivityType, setActivityStatus, undoActivityChange, updateActivityType } from './activityRepo'
import { emptyChapterDraft } from '../domain/syllabus/rules'
import { emptyProfileDraft } from '../domain/profile'

beforeEach(async () => { await db.delete(); await db.open() })

async function setup() {
  const p = await createProfile({ ...emptyProfileDraft(), displayName: 'A' })
  const s = await createSubject(p, { name: 'Math', color: '#4f46e5' })
  const c = await createChapter(p, s, { ...emptyChapterDraft(), name: 'Trig' })
  const types = await db.activityTypes.where('subjectId').equals(s).toArray()
  const t = (n: string) => types.find((x) => x.name === n)!.id
  const rec = (typeId: string) => db.activityRecords.where('[chapterId+activityTypeId]').equals([c, typeId]).first()
  return { p, s, c, t, rec }
}

describe('undo', () => {
  it('removes a record that did not exist before', async () => {
    const { p, c, t, rec } = await setup()
    const change = await setActivityStatus(p, c, t('Theory'), 'done')
    expect(change?.previous).toBeNull()
    expect(await undoActivityChange(p, change!)).toBe(true)
    expect(await rec(t('Theory'))).toBeUndefined()
  })
  it('restores the exact previous record, including its original completion date', async () => {
    const { p, c, t, rec } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    const doneRecord = (await rec(t('Theory')))!
    const unticked = await setActivityStatus(p, c, t('Theory'), 'todo')
    expect(await undoActivityChange(p, unticked!)).toBe(true)
    expect(await rec(t('Theory'))).toEqual(doneRecord)
  })
  it('refuses to undo when the record changed again since', async () => {
    const { p, c, t, rec } = await setup()
    const first = await setActivityStatus(p, c, t('Theory'), 'done')
    await setActivityStatus(p, c, t('Theory'), 'todo')
    expect(await undoActivityChange(p, first!)).toBe(false)
    expect((await rec(t('Theory')))?.status).toBe('todo')
  })
  it('does not let another profile undo', async () => {
    const { p, c, t } = await setup()
    const other = await createProfile({ ...emptyProfileDraft(), displayName: 'B' })
    const change = await setActivityStatus(p, c, t('Theory'), 'done')
    await expect(undoActivityChange(other, change!)).rejects.toThrow()
  })
})

describe('repeated taps', () => {
  it('returns null for a no-op and never duplicates records', async () => {
    const { p, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    expect(await setActivityStatus(p, c, t('Theory'), 'done')).toBeNull()
    expect(await db.activityRecords.where('chapterId').equals(c).count()).toBe(1)
  })
  it('handles simultaneous taps as one change', async () => {
    const { p, c, t, rec } = await setup()
    await Promise.all([
      setActivityStatus(p, c, t('Theory'), 'done'),
      setActivityStatus(p, c, t('Theory'), 'done'),
    ])
    expect(await db.activityRecords.where('chapterId').equals(c).count()).toBe(1)
    expect((await rec(t('Theory')))?.history).toHaveLength(1)
  })
})

describe('show on chapter card', () => {
  it('defaults new subjects to the built-in card set', async () => {
    const { s } = await setup()
    const types = await db.activityTypes.where('subjectId').equals(s).toArray()
    const onCard = types.filter((x) => x.showInCompact !== false).map((x) => x.name).sort()
    expect(onCard).toEqual(['Extra Questions / Question Bank', 'PYQs', 'Question Practice', 'Revision 1', 'Theory'])
  })
  it('hides an activity from the card without touching its records', async () => {
    const { p, c, t } = await setup()
    await setActivityStatus(p, c, t('Theory'), 'done')
    const theory = (await db.activityTypes.get(t('Theory')))!
    await updateActivityType(p, theory.id, { name: theory.name, enabled: true, weight: theory.weight, role: theory.role, showInCompact: false })
    expect((await db.activityTypes.get(theory.id))?.showInCompact).toBe(false)
    expect(await db.activityRecords.count()).toBe(1)
  })
  it('keeps the current setting when an update does not mention it, and defaults new activities to on-card', async () => {
    const { p, s, t } = await setup()
    const notes = (await db.activityTypes.get(t('Notes')))!
    await updateActivityType(p, notes.id, { name: 'Notes', enabled: true, weight: notes.weight, role: notes.role })
    expect((await db.activityTypes.get(notes.id))?.showInCompact).toBe(false)
    const id = await createActivityType(p, s, { name: 'Formula Practice', enabled: true, weight: null, role: 'practice' })
    expect((await db.activityTypes.get(id))?.showInCompact).toBe(true)
  })
})
