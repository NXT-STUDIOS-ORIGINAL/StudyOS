export type TopicStatus = 'not-started' | 'learning' | 'practising' | 'needs-revision' | 'completed'

export const TOPIC_STATUSES: TopicStatus[] = ['not-started', 'learning', 'practising', 'needs-revision', 'completed']

export const STATUS_LABELS: Record<TopicStatus, string> = {
  'not-started': 'Not started',
  learning: 'Learning',
  practising: 'Practising',
  'needs-revision': 'Needs revision',
  completed: 'Completed',
}

export const SUBJECT_COLORS = ['#4f46e5', '#0f766e', '#b45309', '#be123c', '#7e22ce', '#1d4ed8']

export interface Subject {
  id: string
  profileId: string
  name: string
  color: string
  pinned?: boolean // missing = false
  order: number
  createdAt: number
  updatedAt: number
}

export interface Chapter {
  id: string
  profileId: string
  subjectId: string
  name: string
  order: number
  weight: number | null // custom importance weight; null = unknown (counts as 1)
  estimatedMinutes: number | null
  targetDate: string | null // yyyy-MM-dd
  pinned?: boolean // missing = false
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Topic {
  id: string
  profileId: string
  chapterId: string
  name: string
  order: number
  status: TopicStatus
  contentPercent: number // 0..100, how much of the content has been studied
  practised: boolean // questions practised
  revised: boolean // revision completed
  difficulty: number | null // 1..5
  importance: number | null // 1..5
  estimatedMinutes: number | null
  completedAt: number | null // when status became "completed"
  notes: string
  createdAt: number
  updatedAt: number
}

export type SubjectDraft = Pick<Subject, 'name' | 'color'>
export type ChapterDraft = Pick<Chapter, 'name' | 'weight' | 'estimatedMinutes' | 'targetDate' | 'notes'>
export type TopicDraft = Pick<
  Topic,
  'name' | 'status' | 'contentPercent' | 'practised' | 'revised' | 'difficulty' | 'importance' | 'estimatedMinutes' | 'notes'
>
