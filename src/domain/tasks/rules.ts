import { isValidDateString } from '../syllabus/rules'
import { TASK_PRIORITIES, TASK_STATUSES, type TaskDraft } from './types'

export const MAX_TASK_TITLE = 200
export const MAX_TASK_NOTES = 2000

export const emptyTaskDraft = (): TaskDraft => ({
  title: '',
  notes: '',
  priority: 'normal',
  subjectId: null,
  chapterId: null,
  plannedMinutes: null,
  actualMinutes: null,
  startDate: null,
  dueDate: null,
})

const okMinutes = (v: number | null): boolean =>
  v === null || (Number.isInteger(v) && v >= 0 && v <= 1440)

export function validateTaskDraft(d: TaskDraft): string[] {
  const e: string[] = []
  if (d.title.trim().length === 0) e.push('Task title is required.')
  if (d.title.trim().length > MAX_TASK_TITLE) e.push(`Title must be ${MAX_TASK_TITLE} characters or fewer.`)
  if (d.notes.length > MAX_TASK_NOTES) e.push(`Notes must be ${MAX_TASK_NOTES} characters or fewer.`)
  if (!TASK_PRIORITIES.includes(d.priority)) e.push('Unknown priority.')
  if (!okMinutes(d.plannedMinutes)) e.push('Planned time must be a whole number of minutes (up to 1440).')
  if (!okMinutes(d.actualMinutes)) e.push('Actual time must be a whole number of minutes (up to 1440).')
  if (d.startDate !== null && !isValidDateString(d.startDate)) e.push('Start date is not valid.')
  if (d.dueDate !== null && !isValidDateString(d.dueDate)) e.push('Due date is not valid.')
  if (d.startDate && d.dueDate && d.startDate > d.dueDate) e.push('Start date cannot be after the due date.')
  if (d.chapterId !== null && d.subjectId === null) e.push('A chapter link needs its subject.')
  return e
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Row check used when importing a backup. */
export function validateTaskRecord(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const e: string[] = []
  const id = (v: unknown) => v === null || (isStr(v) && v.length > 0)
  const date = (v: unknown) => v === null || (isStr(v) && isValidDateString(v))
  const minutes = (v: unknown) => v === null || (isNum(v) && okMinutes(v))
  if (!isStr(row.id) || row.id.length === 0) e.push('id is missing')
  if (row.profileId !== ownerId) e.push('record belongs to a different profile')
  if (!isStr(row.title) || row.title.trim().length === 0 || row.title.length > MAX_TASK_TITLE) {
    e.push('title must be 1 to 200 characters')
  }
  if (!isStr(row.notes) || row.notes.length > MAX_TASK_NOTES) e.push('notes must be text')
  if (!isStr(row.status) || !(TASK_STATUSES as string[]).includes(row.status)) e.push('status is not recognised')
  if (!isStr(row.priority) || !(TASK_PRIORITIES as string[]).includes(row.priority)) e.push('priority is not recognised')
  if (!id(row.subjectId)) e.push('subjectId must be text or null')
  if (!id(row.chapterId)) e.push('chapterId must be text or null')
  if (row.chapterId !== null && row.subjectId === null) e.push('a chapter link needs a subject link')
  if (!minutes(row.plannedMinutes)) e.push('plannedMinutes must be a whole number or null')
  if (!minutes(row.actualMinutes)) e.push('actualMinutes must be a whole number or null')
  if (!date(row.startDate)) e.push('startDate must be a valid date or null')
  if (!date(row.dueDate)) e.push('dueDate must be a valid date or null')
  if (!(row.completedAt === null || isNum(row.completedAt))) e.push('completedAt must be a number or null')
  for (const k of ['createdAt', 'updatedAt'] as const) if (!isNum(row[k])) e.push(`${k} must be a number`)
  return e
}
