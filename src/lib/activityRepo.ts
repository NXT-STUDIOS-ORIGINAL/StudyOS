import { db } from './db'
import { maxOrder, reorder } from './syllabusRepo'
import { hasDuplicateName, normName } from '../domain/syllabus/rules'
import { appendHistory, validateActivityTypeDraft } from '../domain/activity/rules'
import {
  ACTIVITY_STATUSES, recordId,
  type ActivityRecord, type ActivityStatus, type ActivityType, type ActivityTypeDraft,
} from '../domain/activity/types'
import type { Chapter } from '../domain/syllabus/types'

function rw<T>(fn: () => Promise<T>): Promise<T> {
  return db.transaction('rw', [db.profiles, db.subjects, db.chapters, db.activityTypes, db.activityRecords], fn)
}
function check(errors: string[]): void {
  if (errors.length > 0) throw new Error(errors.join(' '))
}
const dupMsg = (name: string) => `An activity named “${name.trim()}” already exists here.`

async function checkScope(profileId: string, subjectId: string | null): Promise<void> {
  if (subjectId === null) {
    if (!(await db.profiles.get(profileId))) throw new Error('That profile no longer exists.')
    return
  }
  const s = await db.subjects.get(subjectId)
  if (!s || s.profileId !== profileId) throw new Error('That subject was not found.')
}
const scopeTypes = (profileId: string, subjectId: string | null) =>
  db.activityTypes.where('profileId').equals(profileId).filter((t) => t.subjectId === subjectId).toArray()

async function ownedType(profileId: string, id: string): Promise<ActivityType> {
  const t = await db.activityTypes.get(id)
  if (!t || t.profileId !== profileId) throw new Error('That activity was not found.')
  return t
}
async function ownedChapter(profileId: string, id: string): Promise<Chapter> {
  const c = await db.chapters.get(id)
  if (!c || c.profileId !== profileId) throw new Error('That chapter was not found.')
  return c
}

/* ---------- activity types (customisation) ---------- */

export async function createActivityType(
  profileId: string, subjectId: string | null, draft: ActivityTypeDraft,
): Promise<string> {
  check(validateActivityTypeDraft(draft))
  return rw(async () => {
    await checkScope(profileId, subjectId)
    const siblings = await scopeTypes(profileId, subjectId)
    if (hasDuplicateName(draft.name, siblings)) throw new Error(dupMsg(draft.name))
    const id = crypto.randomUUID()
    const t = Date.now()
    await db.activityTypes.add({
      id, profileId, subjectId, name: draft.name.trim(), order: maxOrder(siblings) + 1,
      enabled: draft.enabled, weight: draft.weight, role: draft.role, createdAt: t, updatedAt: t,
    })
    return id
  })
}

export async function updateActivityType(profileId: string, id: string, draft: ActivityTypeDraft): Promise<void> {
  check(validateActivityTypeDraft(draft))
  await rw(async () => {
    const cur = await ownedType(profileId, id)
    const siblings = await scopeTypes(profileId, cur.subjectId)
    if (hasDuplicateName(draft.name, siblings, id)) throw new Error(dupMsg(draft.name))
    await db.activityTypes.put({
      ...cur, name: draft.name.trim(), enabled: draft.enabled, weight: draft.weight, role: draft.role,
      updatedAt: Date.now(),
    })
  })
}

/** Permanently removes the activity and every record of it. Disabling keeps the records. */
export async function deleteActivityType(profileId: string, id: string): Promise<void> {
  await rw(async () => {
    await ownedType(profileId, id)
    await db.activityRecords.where('activityTypeId').equals(id).delete()
    await db.activityTypes.delete(id)
  })
}

export async function moveActivityType(profileId: string, id: string, dir: -1 | 1): Promise<void> {
  await rw(async () => {
    const cur = await ownedType(profileId, id)
    await reorder(db.activityTypes, await scopeTypes(profileId, cur.subjectId), id, dir)
  })
}

/** Adds activities from one list that the destination list does not already have (matched by name). */
export async function copyActivityTypes(
  profileId: string, fromSubjectId: string | null, toSubjectId: string | null,
): Promise<number> {
  if (fromSubjectId === toSubjectId) throw new Error('Choose a different list to copy from.')
  return rw(async () => {
    await checkScope(profileId, fromSubjectId)
    await checkScope(profileId, toSubjectId)
    const source = (await scopeTypes(profileId, fromSubjectId)).sort((a, b) => a.order - b.order)
    const dest = await scopeTypes(profileId, toSubjectId)
    const have = new Set(dest.map((d) => normName(d.name)))
    let order = maxOrder(dest) + 1
    const t = Date.now()
    const rows = source.filter((s) => !have.has(normName(s.name))).map((s) => ({
      ...s, id: crypto.randomUUID(), subjectId: toSubjectId, order: order++, createdAt: t, updatedAt: t,
    }))
    if (rows.length > 0) await db.activityTypes.bulkAdd(rows)
    return rows.length
  })
}

/* ---------- ticking activities ---------- */

async function findRecord(chapterId: string, typeId: string): Promise<ActivityRecord | undefined> {
  const rows = await db.activityRecords.where('[chapterId+activityTypeId]').equals([chapterId, typeId]).toArray()
  return rows.sort((a, b) => b.updatedAt - a.updatedAt)[0]
}

/**
 * Changes ONE activity of ONE chapter. Nothing else is touched.
 * Every change is appended to that record's history; unticking keeps notes and history.
 */
export async function setActivityStatus(
  profileId: string, chapterId: string, typeId: string, status: ActivityStatus,
): Promise<void> {
  if (!ACTIVITY_STATUSES.includes(status)) throw new Error('Unknown status.')
  await rw(async () => {
    const chapter = await ownedChapter(profileId, chapterId)
    const type = await ownedType(profileId, typeId)
    if (type.subjectId !== chapter.subjectId) throw new Error('That activity is not part of this chapter’s subject.')
    const existing = await findRecord(chapterId, typeId)
    const from: ActivityStatus = existing?.status ?? 'todo'
    if (from === status) return
    const now = Date.now()
    await db.activityRecords.put({
      id: existing?.id ?? recordId(chapterId, typeId),
      profileId, chapterId, activityTypeId: typeId, status,
      completedAt: status === 'done' ? now : null,
      notes: existing?.notes ?? '', source: existing?.source ?? '',
      estimatedMinutes: existing?.estimatedMinutes ?? null, actualMinutes: existing?.actualMinutes ?? null,
      history: appendHistory(existing?.history ?? [], { at: now, from, to: status }),
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    })
  })
                                                                      }
