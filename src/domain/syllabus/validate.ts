import { MAX_NAME, MAX_NOTES, isHexColor, isValidDateString } from './rules'
import { TOPIC_STATUSES } from './types'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optNum = (v: unknown, ok: (n: number) => boolean): boolean => v === null || (isNum(v) && ok(v))
const int = (min: number, max: number) => (n: number) => Number.isInteger(n) && n >= min && n <= max

function common(row: Record<string, unknown>, ownerId: string): string[] {
  const e: string[] = []
  if (!isStr(row.id) || row.id.length === 0) e.push('id is missing')
  if (row.profileId !== ownerId) e.push('record belongs to a different profile')
  if (!isStr(row.name) || row.name.trim().length === 0 || row.name.length > MAX_NAME) e.push('name must be 1 to 100 characters')
  for (const k of ['order', 'createdAt', 'updatedAt'] as const) if (!isNum(row[k])) e.push(`${k} must be a number`)
  return e
}

export function validateSubjectRecord(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const e = common(row, ownerId)
  if (!isStr(row.color) || !isHexColor(row.color)) e.push('color must be a hex colour')
  return e
}

export function validateChapterRecord(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const e = common(row, ownerId)
  if (!isStr(row.subjectId) || row.subjectId.length === 0) e.push('subjectId is missing')
  if (!optNum(row.weight, (n) => n > 0 && n <= 1000)) e.push('weight must be above 0 or null')
  if (!optNum(row.estimatedMinutes, int(0, 600000))) e.push('estimatedMinutes must be a whole number or null')
  if (!(row.targetDate === null || (isStr(row.targetDate) && isValidDateString(row.targetDate)))) e.push('targetDate must be a valid date or null')
  if (!isStr(row.notes) || row.notes.length > MAX_NOTES) e.push('notes must be text')
  return e
}

export function validateTopicRecord(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const e = common(row, ownerId)
  if (!isStr(row.chapterId) || row.chapterId.length === 0) e.push('chapterId is missing')
  if (!isStr(row.status) || !(TOPIC_STATUSES as string[]).includes(row.status)) e.push('status is not recognised')
  if (!isNum(row.contentPercent) || !int(0, 100)(row.contentPercent)) e.push('contentPercent must be 0 to 100')
  if (typeof row.practised !== 'boolean') e.push('practised must be true or false')
  if (typeof row.revised !== 'boolean') e.push('revised must be true or false')
  if (!optNum(row.difficulty, int(1, 5))) e.push('difficulty must be 1 to 5 or null')
  if (!optNum(row.importance, int(1, 5))) e.push('importance must be 1 to 5 or null')
  if (!optNum(row.estimatedMinutes, int(0, 600000))) e.push('estimatedMinutes must be a whole number or null')
  if (!optNum(row.completedAt, () => true)) e.push('completedAt must be a number or null')
  if (!isStr(row.notes) || row.notes.length > MAX_NOTES) e.push('notes must be text')
  return e
      }
