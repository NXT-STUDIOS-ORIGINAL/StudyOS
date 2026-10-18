import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Task } from '../domain/tasks/types'

/** undefined while loading. Only reads the given profile's tasks. */
export function useTasks(profileId: string): Task[] | undefined {
  return useLiveQuery(() => db.tasks.where('profileId').equals(profileId).toArray(), [profileId])
}
