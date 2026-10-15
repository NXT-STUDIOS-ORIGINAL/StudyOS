import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { Chapter, Subject, Topic } from '../domain/syllabus/types'

export interface SyllabusData { subjects: Subject[]; chapters: Chapter[]; topics: Topic[] }

const byOrder = <T extends { order: number; createdAt: number }>(a: T, b: T) =>
  a.order - b.order || a.createdAt - b.createdAt

/** undefined while loading. Only ever reads the given profile's records. */
export function useSyllabus(profileId: string): SyllabusData | undefined {
  return useLiveQuery(async (): Promise<SyllabusData> => {
    const [subjects, chapters, topics] = await Promise.all([
      db.subjects.where('profileId').equals(profileId).toArray(),
      db.chapters.where('profileId').equals(profileId).toArray(),
      db.topics.where('profileId').equals(profileId).toArray(),
    ])
    return { subjects: subjects.sort(byOrder), chapters: chapters.sort(byOrder), topics: topics.sort(byOrder) }
  }, [profileId])
}
