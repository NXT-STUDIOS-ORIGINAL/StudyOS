import { db } from './db'
import {
  CHAPTER_FILTERS, TRACKER_VIEWS, defaultTrackerPrefs, type TrackerPrefs,
} from '../domain/tracker/tracker'

export type TrackerPrefsPatch = Partial<Pick<TrackerPrefs, 'view' | 'defaultSubjectId' | 'lastSubjectId' | 'filter'>>

export async function saveTrackerPrefs(profileId: string, patch: TrackerPrefsPatch): Promise<void> {
  if (patch.view !== undefined && !TRACKER_VIEWS.includes(patch.view)) throw new Error('Unknown layout.')
  if (patch.filter !== undefined && !CHAPTER_FILTERS.includes(patch.filter)) throw new Error('Unknown filter.')
  await db.transaction('rw', db.profiles, db.subjects, db.trackerPrefs, async () => {
    if (!(await db.profiles.get(profileId))) throw new Error('That profile no longer exists.')
    for (const sid of [patch.defaultSubjectId, patch.lastSubjectId]) {
      if (sid === undefined || sid === null) continue
      const s = await db.subjects.get(sid)
      if (!s || s.profileId !== profileId) throw new Error('That subject was not found.')
    }
    const cur = (await db.trackerPrefs.get(profileId)) ?? defaultTrackerPrefs(profileId)
    await db.trackerPrefs.put({ ...cur, ...patch, profileId, updatedAt: Date.now() })
  })
}

export async function resetTrackerPrefs(profileId: string): Promise<void> {
  await db.trackerPrefs.where('profileId').equals(profileId).delete()
}

export async function setSubjectPinned(profileId: string, id: string, pinned: boolean): Promise<void> {
  await db.transaction('rw', db.subjects, async () => {
    const s = await db.subjects.get(id)
    if (!s || s.profileId !== profileId) throw new Error('That subject was not found.')
    await db.subjects.put({ ...s, pinned, updatedAt: Date.now() })
  })
}

export async function setChapterPinned(profileId: string, id: string, pinned: boolean): Promise<void> {
  await db.transaction('rw', db.chapters, async () => {
    const c = await db.chapters.get(id)
    if (!c || c.profileId !== profileId) throw new Error('That chapter was not found.')
    await db.chapters.put({ ...c, pinned, updatedAt: Date.now() })
  })
}
