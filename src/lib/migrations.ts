import type { Transaction } from 'dexie'
import type { Profile } from '../domain/types'
import type { Chapter, Subject, Topic } from '../domain/syllabus/types'
import { recordId, type ActivityRecord, type ActivityType } from '../domain/activity/types'
import { buildActivityTypes } from '../domain/activity/defaults'
import { COMPACT_DEFAULT_NAMES, DEFAULT_ACTIVITY_NAMES } from '../domain/activity/defaults'

/**
 * v4: seeds the default activity set for every profile and subject, and converts the old
 * topic checklist flags (practised / revised) into chapter activity records.
 * The old topic fields are left untouched.
 */
export async function migrateToActivities(tx: Transaction): Promise<void> {
  const now = Date.now()
  const profiles = await tx.table<Profile, string>('profiles').toArray()
  const subjects = await tx.table<Subject, string>('subjects').toArray()
  const chapters = await tx.table<Chapter, string>('chapters').toArray()
  const topics = await tx.table<Topic, string>('topics').toArray()
  const typesTable = tx.table<ActivityType, string>('activityTypes')
  const recordsTable = tx.table<ActivityRecord, string>('activityRecords')

  for (const p of profiles) await typesTable.bulkAdd(buildActivityTypes(p.id, null, now).map((x) => x.row))

  const practice = new Map<string, ActivityType>()
  const rev1 = new Map<string, ActivityType>()
  for (const s of subjects) {
    const built = buildActivityTypes(s.profileId, s.id, now)
    await typesTable.bulkAdd(built.map((x) => x.row))
    const p = built.find((x) => x.key === 'practice')
    const r = built.find((x) => x.key === 'rev1')
    if (p) practice.set(s.id, p.row)
    if (r) rev1.set(s.id, r.row)
  }

  const chapterById = new Map(chapters.map((c) => [c.id, c]))
  const byChapter = new Map<string, Topic[]>()
  for (const t of topics) {
    const arr = byChapter.get(t.chapterId)
    if (arr) arr.push(t)
    else byChapter.set(t.chapterId, [t])
  }

  const rows: ActivityRecord[] = []
  for (const [chapterId, ts] of byChapter) {
    const ch = chapterById.get(chapterId)
    if (!ch) continue
    const jobs = [
      { type: practice.get(ch.subjectId), count: ts.filter((t) => t.practised).length, label: 'practised' },
      { type: rev1.get(ch.subjectId), count: ts.filter((t) => t.revised).length, label: 'revised' },
    ]
    for (const job of jobs) {
      if (!job.type || job.count === 0) continue
      const all = job.count === ts.length
      rows.push({
        id: recordId(chapterId, job.type.id), profileId: ch.profileId, chapterId, activityTypeId: job.type.id,
        status: all ? 'done' : 'todo', completedAt: all ? now : null,
        notes: `Migrated from the earlier topic checklist: ${job.count} of ${ts.length} topic(s) were marked ${job.label}.${all ? ' Completion date is the migration date.' : ''}`,
        source: '', estimatedMinutes: null, actualMinutes: null,
        history: all ? [{ at: now, from: 'todo', to: 'done' }] : [],
        createdAt: now, updatedAt: now,
      })
    }
  }
  if (rows.length > 0) await recordsTable.bulkAdd(rows)
}

/**
 * v5: gives existing activities a "show on card" value. The ten built-in names follow the
 * default card set; any activity you created yourself stays visible on the card.
 */
export async function migrateCompactDefaults(tx: Transaction): Promise<void> {
  await tx.table('activityTypes').toCollection().modify((t: { name: string; showInCompact?: boolean }) => {
    if (t.showInCompact === undefined) {
      t.showInCompact = !DEFAULT_ACTIVITY_NAMES.has(t.name) || COMPACT_DEFAULT_NAMES.has(t.name)
    }
  })
}
