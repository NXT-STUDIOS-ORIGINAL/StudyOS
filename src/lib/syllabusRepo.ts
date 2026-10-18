import type { Table } from 'dexie'
import { db } from './db'
import {
  applyTopicRules, emptyTopicDraft, hasDuplicateName, MAX_NAME, normName,
  validateChapterDraft, validateSubjectDraft, validateTopicDraft,
} from '../domain/syllabus/rules'
import type {
  Chapter, ChapterDraft, Subject, SubjectDraft, Topic, TopicDraft, TopicStatus,
} from '../domain/syllabus/types'

export type SyllabusKind = 'subject' | 'chapter' | 'topic'

function rw<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction(
    'rw',
    [db.profiles, db.subjects, db.chapters, db.topics, db.activityTypes, db.activityRecords, db.tasks],
    fn,
  )
}
function check(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join(' '))
}
export const maxOrder = (xs: { order: number }[]) => xs.reduce((m, x) => Math.max(m, x.order), -1)
const dupMsg = (what: string, name: string) => `A ${what} named “${name.trim()}” already exists here.`

async function ownedSubject(profileId: string, id: string): Promise<Subject> {
  const s = await db.subjects.get(id)
  if (!s || s.profileId !== profileId) throw new Error('That subject was not found.')
  return s
}
async function ownedChapter(profileId: string, id: string): Promise<Chapter> {
  const c = await db.chapters.get(id)
  if (!c || c.profileId !== profileId) throw new Error('That chapter was not found.')
  return c
}
async function ownedTopic(profileId: string, id: string): Promise<Topic> {
  const t = await db.topics.get(id)
  if (!t || t.profileId !== profileId) throw new Error('That topic was not found.')
  return t
}

/* ---------- subjects ---------- */

export async function createSubject(profileId: string, draft: SubjectDraft): Promise<string> {
  check(validateSubjectDraft(draft))
  return rw(async () => {
    if (!(await db.profiles.get(profileId))) throw new Error('That profile no longer exists.')
    const siblings = await db.subjects.where('profileId').equals(profileId).toArray()
    if (hasDuplicateName(draft.name, siblings)) throw new Error(dupMsg('subject', draft.name))
    const id = crypto.randomUUID()
    const t = Date.now()
    await db.subjects.add({
      id, profileId, name: draft.name.trim(), color: draft.color,
      order: maxOrder(siblings) + 1, createdAt: t, updatedAt: t,
    })
    // The new subject starts with a copy of the profile's default activity set.
    const template = await db.activityTypes.where('profileId').equals(profileId).filter((a) => a.subjectId === null).toArray()
    if (template.length > 0) {
      await db.activityTypes.bulkAdd(
        template.map((a) => ({ ...a, id: crypto.randomUUID(), subjectId: id, createdAt: t, updatedAt: t })),
      )
    }
    return id
  })
}

export async function updateSubject(profileId: string, id: string, draft: SubjectDraft): Promise<void> {
  check(validateSubjectDraft(draft))
  await rw(async () => {
    const s = await ownedSubject(profileId, id)
    const siblings = await db.subjects.where('profileId').equals(profileId).toArray()
    if (hasDuplicateName(draft.name, siblings, id)) throw new Error(dupMsg('subject', draft.name))
    await db.subjects.put({ ...s, name: draft.name.trim(), color: draft.color, updatedAt: Date.now() })
  })
}

export async function deleteSubject(profileId: string, id: string): Promise<void> {
  await rw(async () => {
    await ownedSubject(profileId, id)
    const chapterIds = await db.chapters.where('subjectId').equals(id).primaryKeys()
    await db.activityRecords.where('chapterId').anyOf(chapterIds).delete()
    await db.topics.where('chapterId').anyOf(chapterIds).delete()
    await db.chapters.bulkDelete(chapterIds)
    await db.activityTypes.where('subjectId').equals(id).delete()
    await db.tasks.where('subjectId').equals(id).modify({ subjectId: null, chapterId: null })
    await db.subjects.delete(id)
  })
}

/* ---------- chapters ---------- */

export async function createChapter(profileId: string, subjectId: string, draft: ChapterDraft): Promise<string> {
  check(validateChapterDraft(draft))
  return rw(async () => {
    await ownedSubject(profileId, subjectId)
    const siblings = await db.chapters.where('subjectId').equals(subjectId).toArray()
    if (hasDuplicateName(draft.name, siblings)) throw new Error(dupMsg('chapter', draft.name))
    const id = crypto.randomUUID()
    const t = Date.now()
    await db.chapters.add({
      id, profileId, subjectId, name: draft.name.trim(), order: maxOrder(siblings) + 1,
      weight: draft.weight, estimatedMinutes: draft.estimatedMinutes, targetDate: draft.targetDate,
      notes: draft.notes, createdAt: t, updatedAt: t,
    })
    return id
  })
}

export async function updateChapter(profileId: string, id: string, draft: ChapterDraft): Promise<void> {
  check(validateChapterDraft(draft))
  await rw(async () => {
    const c = await ownedChapter(profileId, id)
    const siblings = await db.chapters.where('subjectId').equals(c.subjectId).toArray()
    if (hasDuplicateName(draft.name, siblings, id)) throw new Error(dupMsg('chapter', draft.name))
    await db.chapters.put({
      ...c, name: draft.name.trim(), weight: draft.weight, estimatedMinutes: draft.estimatedMinutes,
      targetDate: draft.targetDate, notes: draft.notes, updatedAt: Date.now(),
    })
  })
}

export async function deleteChapter(profileId: string, id: string): Promise<void> {
  await rw(async () => {
    await ownedChapter(profileId, id)
    await db.activityRecords.where('chapterId').equals(id).delete()
    await db.tasks.where('chapterId').equals(id).modify({ chapterId: null })
    await db.topics.where('chapterId').equals(id).delete()
    await db.chapters.delete(id)
  })
}

/* ---------- topics ---------- */

export async function createTopic(profileId: string, chapterId: string, draft: TopicDraft): Promise<string> {
  check(validateTopicDraft(draft))
  return rw(async () => {
    await ownedChapter(profileId, chapterId)
    const siblings = await db.topics.where('chapterId').equals(chapterId).toArray()
    if (hasDuplicateName(draft.name, siblings)) throw new Error(dupMsg('topic', draft.name))
    const t = Date.now()
    const r = applyTopicRules({ status: draft.status, contentPercent: draft.contentPercent }, null, null, t)
    const id = crypto.randomUUID()
    await db.topics.add({
      id, profileId, chapterId, name: draft.name.trim(), order: maxOrder(siblings) + 1,
      status: r.status, contentPercent: r.contentPercent, practised: draft.practised, revised: draft.revised,
      difficulty: draft.difficulty, importance: draft.importance, estimatedMinutes: draft.estimatedMinutes,
      completedAt: r.completedAt, notes: draft.notes, createdAt: t, updatedAt: t,
    })
    return id
  })
}

export async function updateTopic(profileId: string, id: string, draft: TopicDraft): Promise<void> {
  check(validateTopicDraft(draft))
  await rw(async () => {
    const prev = await ownedTopic(profileId, id)
    const siblings = await db.topics.where('chapterId').equals(prev.chapterId).toArray()
    if (hasDuplicateName(draft.name, siblings, id)) throw new Error(dupMsg('topic', draft.name))
    const t = Date.now()
    const r = applyTopicRules({ status: draft.status, contentPercent: draft.contentPercent }, prev.status, prev.completedAt, t)
    await db.topics.put({
      ...prev, name: draft.name.trim(), status: r.status, contentPercent: r.contentPercent,
      practised: draft.practised, revised: draft.revised, difficulty: draft.difficulty,
      importance: draft.importance, estimatedMinutes: draft.estimatedMinutes,
      completedAt: r.completedAt, notes: draft.notes, updatedAt: t,
    })
  })
}

export async function setTopicStatus(profileId: string, id: string, status: TopicStatus): Promise<void> {
  await rw(async () => {
    const prev = await ownedTopic(profileId, id)
    const t = Date.now()
    const r = applyTopicRules({ status, contentPercent: prev.contentPercent }, prev.status, prev.completedAt, t)
    await db.topics.put({ ...prev, ...r, updatedAt: t })
  })
}

export async function deleteTopic(profileId: string, id: string): Promise<void> {
  await rw(async () => {
    await ownedTopic(profileId, id)
    await db.topics.delete(id)
  })
}

/** One topic per line. Duplicates (existing or repeated in the input) are skipped and reported. */
export async function bulkAddTopics(
  profileId: string, chapterId: string, text: string,
): Promise<{ added: number; skipped: string[] }> {
  const lines = text.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean)
  if (lines.length === 0) throw new Error('Enter at least one topic name.')
  if (lines.length > 200) throw new Error('Add at most 200 topics at a time.')
  if (lines.some((l) => l.length > MAX_NAME)) throw new Error(`Topic names must be ${MAX_NAME} characters or fewer.`)
  return rw(async () => {
    await ownedChapter(profileId, chapterId)
    const existing = await db.topics.where('chapterId').equals(chapterId).toArray()
    const seen = new Set(existing.map((t) => normName(t.name)))
    let order = maxOrder(existing) + 1
    const t = Date.now()
    const rows: Topic[] = []
    const skipped: string[] = []
    for (const name of lines) {
      const key = normName(name)
      if (seen.has(key)) { skipped.push(name); continue }
      seen.add(key)
      rows.push({
        ...emptyTopicDraft(), name, id: crypto.randomUUID(), profileId, chapterId,
        order: order++, completedAt: null, createdAt: t, updatedAt: t,
      })
    }
    await db.topics.bulkAdd(rows)
    return { added: rows.length, skipped }
  })
}

/* ---------- reordering ---------- */

export async function reorder<T extends { id: string; order: number; createdAt: number }>(
  table: Table<T, string>, siblings: T[], id: string, dir: -1 | 1,
): Promise<void> {
  const sorted = [...siblings].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)
  const i = sorted.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= sorted.length) return
  ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
  await table.bulkPut(sorted.map((x, k) => ({ ...x, order: k })))
}

export async function moveItem(profileId: string, kind: SyllabusKind, id: string, dir: -1 | 1): Promise<void> {
  await rw(async () => {
    if (kind === 'subject') {
      await ownedSubject(profileId, id)
      await reorder(db.subjects, await db.subjects.where('profileId').equals(profileId).toArray(), id, dir)
    } else if (kind === 'chapter') {
      const c = await ownedChapter(profileId, id)
      await reorder(db.chapters, await db.chapters.where('subjectId').equals(c.subjectId).toArray(), id, dir)
    } else {
      const t = await ownedTopic(profileId, id)
      await reorder(db.topics, await db.topics.where('chapterId').equals(t.chapterId).toArray(), id, dir)
    }
  })
}
