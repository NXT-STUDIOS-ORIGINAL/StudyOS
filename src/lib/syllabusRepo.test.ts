import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProfile, db, deleteProfile } from './db'
import {
  bulkAddTopics, createChapter, createSubject, createTopic, deleteChapter, deleteSubject,
  moveItem, setTopicStatus, updateSubject, updateTopic,
} from './syllabusRepo'
import { emptyChapterDraft, emptyTopicDraft } from '../domain/syllabus/rules'
import { emptyProfileDraft } from '../domain/profile'

const prof = (n: string) => createProfile({ ...emptyProfileDraft(), displayName: n })
const subj = (pid: string, name: string) => createSubject(pid, { name, color: '#4f46e5' })
const chap = (pid: string, sid: string, name: string) => createChapter(pid, sid, { ...emptyChapterDraft(), name })
const topic = (pid: string, cid: string, name: string) => createTopic(pid, cid, { ...emptyTopicDraft(), name })

beforeEach(async () => { await db.delete(); await db.open() })

describe('hierarchy', () => {
  it('builds subject → chapter → topic', async () => {
    const p = await prof('A')
    const s = await subj(p, 'Math')
    const c = await chap(p, s, 'Algebra')
    const t = await topic(p, c, 'Linear equations')
    expect((await db.topics.get(t))?.chapterId).toBe(c)
    expect((await db.chapters.get(c))?.subjectId).toBe(s)
    expect((await db.topics.get(t))?.profileId).toBe(p)
  })
  it('rejects duplicates per parent, case-insensitively, but allows the same name elsewhere', async () => {
    const p = await prof('A')
    const s1 = await subj(p, 'Math')
    const s2 = await subj(p, 'Physics')
    await expect(subj(p, ' math ')).rejects.toThrow(/already exists/)
    await chap(p, s1, 'Intro')
    await expect(chap(p, s1, 'INTRO')).rejects.toThrow()
    await expect(chap(p, s2, 'Intro')).resolves.toBeTruthy()
  })
  it('rejects invalid input without writing', async () => {
    const p = await prof('A')
    await expect(subj(p, '   ')).rejects.toThrow()
    expect(await db.subjects.count()).toBe(0)
  })
})

describe('profile isolation at the data layer', () => {
  it('refuses to touch another profile’s records', async () => {
    const a = await prof('A')
    const b = await prof('B')
    const s = await subj(a, 'Math')
    const c = await chap(a, s, 'C1')
    const t = await topic(a, c, 'T1')
    await expect(updateSubject(b, s, { name: 'X', color: '#4f46e5' })).rejects.toThrow()
    await expect(deleteSubject(b, s)).rejects.toThrow()
    await expect(createChapter(b, s, { ...emptyChapterDraft(), name: 'Y' })).rejects.toThrow()
    await expect(createTopic(b, c, { ...emptyTopicDraft(), name: 'Z' })).rejects.toThrow()
    await expect(moveItem(b, 'subject', s, 1)).rejects.toThrow()
    await expect(setTopicStatus(b, t, 'completed')).rejects.toThrow()
    expect(await db.topics.count()).toBe(1)
    expect((await db.subjects.get(s))?.name).toBe('Math')
  })
  it('keeps same-named subjects in different profiles separate', async () => {
    const a = await prof('A')
    const b = await prof('B')
    await subj(a, 'Math')
    await subj(b, 'Math')
    expect(await db.subjects.where('profileId').equals(a).count()).toBe(1)
    expect(await db.subjects.where('profileId').equals(b).count()).toBe(1)
  })
  it('deleting a profile removes only its syllabus', async () => {
    const a = await prof('A')
    const b = await prof('B')
    for (const p of [a, b]) {
      const s = await subj(p, 'Math')
      const c = await chap(p, s, 'C')
      await topic(p, c, 'T')
    }
    await deleteProfile(a)
    expect(await db.subjects.where('profileId').equals(a).count()).toBe(0)
    expect(await db.chapters.where('profileId').equals(a).count()).toBe(0)
    expect(await db.topics.where('profileId').equals(a).count()).toBe(0)
    expect(await db.topics.where('profileId').equals(b).count()).toBe(1)
  })
})

describe('deleting', () => {
  it('cascades from subject and chapter without touching siblings', async () => {
    const p = await prof('A')
    const s1 = await subj(p, 'Math')
    const s2 = await subj(p, 'Physics')
    const c1 = await chap(p, s1, 'C1')
    const c2 = await chap(p, s1, 'C2')
    const c3 = await chap(p, s2, 'C3')
    await topic(p, c1, 'T1'); await topic(p, c2, 'T2'); await topic(p, c3, 'T3')
    await deleteChapter(p, c1)
    expect(await db.topics.count()).toBe(2)
    await deleteSubject(p, s1)
    expect(await db.chapters.count()).toBe(1)
    expect((await db.topics.toArray()).map((t) => t.name)).toEqual(['T3'])
  })
})

describe('topics', () => {
  it('bulk add skips existing and repeated names', async () => {
    const p = await prof('A')
    const c = await chap(p, await subj(p, 'Math'), 'C')
    await topic(p, c, 'Existing')
    const r = await bulkAddTopics(p, c, 'existing\nNew one\n\n  new   ONE \nAnother')
    expect(r.added).toBe(2)
    expect(r.skipped).toEqual(['existing', 'new ONE'])
    expect(await db.topics.where('chapterId').equals(c).count()).toBe(3)
    await expect(bulkAddTopics(p, c, '   \n')).rejects.toThrow()
  })
  it('applies status rules on create, update and quick status change', async () => {
    const p = await prof('A')
    const c = await chap(p, await subj(p, 'Math'), 'C')
    const id = await createTopic(p, c, { ...emptyTopicDraft(), name: 'T', status: 'completed' })
    const done = await db.topics.get(id)
    expect(done?.contentPercent).toBe(100)
    expect(done?.completedAt).not.toBeNull()
    await updateTopic(p, id, { ...emptyTopicDraft(), name: 'T', status: 'completed', contentPercent: 50 })
    expect((await db.topics.get(id))?.status).toBe('learning')
    expect((await db.topics.get(id))?.completedAt).toBeNull()
    await setTopicStatus(p, id, 'not-started')
    expect((await db.topics.get(id))?.contentPercent).toBe(0)
  })
  it('reorders siblings and ignores moves past the ends', async () => {
    const p = await prof('A')
    const c = await chap(p, await subj(p, 'Math'), 'C')
    const a = await topic(p, c, 'A')
    const b = await topic(p, c, 'B')
    await topic(p, c, 'C3')
    await moveItem(p, 'topic', b, -1)
    const names = async () => (await db.topics.where('chapterId').equals(c).toArray()).sort((x, y) => x.order - y.order).map((t) => t.name)
    expect(await names()).toEqual(['B', 'A', 'C3'])
    await moveItem(p, 'topic', b, -1)
    expect(await names()).toEqual(['B', 'A', 'C3'])
    await moveItem(p, 'topic', a, 1)
    expect(await names()).toEqual(['B', 'C3', 'A'])
  })
})
