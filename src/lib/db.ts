import Dexie, { type Table } from 'dexie'
import type { Profile, ProfileDraft, ProfileSettings, SettingsDraft } from '../domain/types'
import type { Chapter, Subject, Topic } from '../domain/syllabus/types'
import type { ActivityRecord, ActivityType } from '../domain/activity/types'
import type { TrackerPrefs } from '../domain/tracker/tracker'
import type { Task } from '../domain/tasks/types'
import { buildActivityTypes } from '../domain/activity/defaults'
import { DEFAULT_SETTINGS } from '../domain/settings'
import { legacyToProfile, type LegacySettings } from '../domain/migration'
import { migrateCompactDefaults, migrateToActivities } from './migrations'

export interface AppStateRow { key: string; value: string }

export const ACTIVE_KEY = 'activeProfileId'

/**
 * Every table that stores per-profile records MUST be listed here, carry an indexed
 * `profileId`, and have a matching entry (same order) in BACKUP_TABLES.
 * Parents come before children.
 */
export const PROFILE_OWNED_TABLES = [
  'profileSettings',
  'subjects',
  'activityTypes',
  'chapters',
  'topics',
  'activityRecords',
  'trackerPrefs',
  'tasks',
] as const

export class StudyOSDB extends Dexie {
  settings!: Table<LegacySettings, string> // legacy (v1), kept untouched for safety
  profiles!: Table<Profile, string>
  profileSettings!: Table<ProfileSettings, string>
  appState!: Table<AppStateRow, string>
  subjects!: Table<Subject, string>
  chapters!: Table<Chapter, string>
  topics!: Table<Topic, string>
  activityTypes!: Table<ActivityType, string>
  activityRecords!: Table<ActivityRecord, string>
  trackerPrefs!: Table<TrackerPrefs, string>
  tasks!: Table<Task, string>

  constructor() {
    super('studyos')
    this.version(1).stores({ settings: 'id' })
    this.version(2)
      .stores({
        settings: 'id',
        profiles: 'id, lastActiveAt',
        profileSettings: 'profileId',
        appState: 'key',
      })
      .upgrade(async (tx) => {
        const old = await tx.table<LegacySettings, string>('settings').get('main')
        const migrated = legacyToProfile(old, crypto.randomUUID(), Date.now())
        if (!migrated) return
        await tx.table('profiles').add(migrated.profile)
        await tx.table('profileSettings').add(migrated.settings)
        await tx.table('appState').put({ key: ACTIVE_KEY, value: migrated.profile.id })
      })
    this.version(3).stores({
      subjects: 'id, profileId',
      chapters: 'id, profileId, subjectId',
      topics: 'id, profileId, chapterId',
    })
    this.version(4)
      .stores({
        activityTypes: 'id, profileId, subjectId',
        activityRecords: 'id, profileId, chapterId, activityTypeId, [chapterId+activityTypeId]',
      })
      .upgrade(migrateToActivities)
    this.version(5)
      .stores({ trackerPrefs: 'profileId' })
      .upgrade(migrateCompactDefaults)
    // v6: tasks (additive, no data changes)
    this.version(6).stores({
      tasks: 'id, profileId, subjectId, chapterId, dueDate, status',
    })
  }
}

export const db = new StudyOSDB()

export async function getActiveProfileId(): Promise<string | null> {
  return (await db.appState.get(ACTIVE_KEY))?.value ?? null
}

/** Creates a profile with its settings and default activity set, and makes it active, atomically. */
export async function createProfile(
  draft: ProfileDraft,
  settings: SettingsDraft = DEFAULT_SETTINGS,
): Promise<string> {
  const id = crypto.randomUUID()
  const now = Date.now()
  await db.transaction('rw', db.profiles, db.profileSettings, db.appState, db.activityTypes, async () => {
    await db.profiles.add({ ...draft, id, createdAt: now, lastActiveAt: now })
    await db.profileSettings.add({ ...settings, profileId: id, updatedAt: now })
    await db.activityTypes.bulkAdd(buildActivityTypes(id, null, now).map((x) => x.row))
    await db.appState.put({ key: ACTIVE_KEY, value: id })
  })
  return id
}

export async function updateProfile(id: string, draft: ProfileDraft): Promise<void> {
  const changed = await db.profiles.update(id, draft)
  if (changed === 0) throw new Error('That profile no longer exists.')
}

export async function setActiveProfile(id: string): Promise<void> {
  await db.transaction('rw', db.profiles, db.appState, async () => {
    const changed = await db.profiles.update(id, { lastActiveAt: Date.now() })
    if (changed === 0) throw new Error('That profile no longer exists.')
    await db.appState.put({ key: ACTIVE_KEY, value: id })
  })
}

export async function saveProfileSettings(profileId: string, draft: SettingsDraft): Promise<void> {
  if (!(await db.profiles.get(profileId))) throw new Error('That profile no longer exists.')
  await db.profileSettings.put({ ...draft, profileId, updatedAt: Date.now() })
}

/** Deletes a profile and all records it owns in one transaction. */
export async function deleteProfile(id: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const name of PROFILE_OWNED_TABLES) {
      await db.table(name).where('profileId').equals(id).delete()
    }
    await db.profiles.delete(id)
    const active = await db.appState.get(ACTIVE_KEY)
    if (active?.value === id) {
      const next = await db.profiles.orderBy('lastActiveAt').reverse().first()
      if (next) await db.appState.put({ key: ACTIVE_KEY, value: next.id })
      else await db.appState.delete(ACTIVE_KEY)
    }
  })
}
