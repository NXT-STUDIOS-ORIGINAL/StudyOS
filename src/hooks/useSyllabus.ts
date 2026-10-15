import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Chapter, Subject, Topic } from '../domain/syllabus/types'
import type { ActivityRecord, ActivityType } from '../domain/activity/types'

export interface SyllabusData {
  subjects: Subject[]
  chapters: Chapter[]
  topics: Topic[]
  activityTypes: ActivityType[]
  activityRecords: ActivityRecord[]
}

const byOrder = <T extends { order: number; createdAt: number }>(a: T, b: T) =>
  a.order - b.order || a.createdAt - b.createdAt

/** undefined while loading. Only ever reads the given profile's records. */
export function useSyllabus(profileId: string): SyllabusData | undefined {
  return useLiveQuery(async (): Promise<SyllabusData> => {
    const own = <T,>(table: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<T[]> } } }) =>
      table.where('profileId').equals(profileId).toArray()
    const [subjects, chapters, topics, activityTypes, activityRecords] = await Promise.all([
      own<Subject>(db.subjects), own<Chapter>(db.chapters), own<Topic>(db.topics),
      own<ActivityType>(db.activityTypes), own<ActivityRecord>(db.activityRecords),
    ])
    return {
      subjects: subjects.sort(byOrder), chapters: chapters.sort(byOrder), topics: topics.sort(byOrder),
      activityTypes: activityTypes.sort(byOrder), activityRecords,
    }
  }, [profileId])
}
