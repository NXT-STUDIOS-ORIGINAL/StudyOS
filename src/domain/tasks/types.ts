export type TaskPriority = 'low' | 'normal' | 'high'
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'normal', 'high']
export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
}

export type TaskStatus = 'todo' | 'done'
export const TASK_STATUSES: TaskStatus[] = ['todo', 'done']

export interface Task {
  id: string
  profileId: string
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority
  subjectId: string | null
  chapterId: string | null // a chapter link always comes with its subject
  plannedMinutes: number | null
  actualMinutes: number | null
  startDate: string | null // yyyy-MM-dd, local date
  dueDate: string | null // yyyy-MM-dd, local date
  completedAt: number | null
  createdAt: number
  updatedAt: number
}

export type TaskDraft = Pick<
  Task,
  | 'title'
  | 'notes'
  | 'priority'
  | 'subjectId'
  | 'chapterId'
  | 'plannedMinutes'
  | 'actualMinutes'
  | 'startDate'
  | 'dueDate'
>
