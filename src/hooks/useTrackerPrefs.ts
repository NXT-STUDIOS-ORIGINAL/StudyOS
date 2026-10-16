import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { defaultTrackerPrefs, type TrackerPrefs } from '../domain/tracker/tracker'

/** undefined while loading; defaults when nothing has been saved yet. */
export function useTrackerPrefs(profileId: string): TrackerPrefs | undefined {
  return useLiveQuery(
    async () => (await db.trackerPrefs.get(profileId)) ?? defaultTrackerPrefs(profileId),
    [profileId],
  )
}
