import { ACTIVITY_ROLES, ACTIVITY_STATUSES, MAX_ACTIVITY_NAME } from './types'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optInt = (v: unknown) => v === null || (isNum(v) && Number.isInteger(v) && v >= 0 && v <= 600000)
const statuses = ACTIVITY_STATUSES as string[]

function base(row: Record<string, unknown>, ownerId: string): string[] {
  const e: string[] = []
  if (!isStr(row.id) || row.id.length === 0) e.push('id is missing')
  if (row.profileId !== ownerId) e.push('record belongs to a different profile')
  for (const k of ['createdAt', 'updatedAt'] as const) if (!isNum(row[k])) e.push(`${k} must be a number`)
  return e
}

export function validateActivityTypeRecord(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const e = base(row, ownerId)
  if (!(row.subjectId === null || (isStr(row.subjectId) && row.subjectId.length > 0))) e.push('subjectId must be text or null')
  if (!isStr(row.name) || row.name.trim().length === 0 || row.name.length > MAX_ACTIVITY_NAME) e.push('name must be 1 to 60 characters')
  if (!isNum(row.order)) e.push('order must be a number')
  if (typeof row.enabled !== 'boolean') e.push('enabled must be true or false')
  if (!(row.weight === null || (isNum(row.weight) && row.weight > 0 && row.weight <= 100))) e.push('weight must be above 0 or null')
  if (!isStr(row.role) || !(ACTIVITY_ROLES as string[]).includes(row.role)) e.push('role is not recognised')
  if (!(row.showInCompact === undefined || typeof row.showInCompact === 'boolean')) e.push('showInCompact must be true or false')
  return e
}

export function validateActivityRecord(row: unknown, ownerId: string): string[] {
  if (!isRecord(row)) return ['record is not an object']
  const e = base(row, ownerId)
  if (!isStr(row.chapterId) || row.chapterId.length === 0) e.push('chapterId is missing')
  if (!isStr(row.activityTypeId) || row.activityTypeId.length === 0) e.push('activityTypeId is missing')
  if (!isStr(row.status) || !statuses.includes(row.status)) e.push('status is not recognised')
  if (!(row.completedAt === null || isNum(row.completedAt))) e.push('completedAt must be a number or null')
  if (!isStr(row.notes) || row.notes.length > 5000) e.push('notes must be text')
  if (!isStr(row.source) || row.source.length > 200) e.push('source must be text')
  if (!optInt(row.estimatedMinutes)) e.push('estimatedMinutes must be a whole number or null')
  if (!optInt(row.actualMinutes)) e.push('actualMinutes must be a whole number or null')
  if (!Array.isArray(row.history) || row.history.length > 200) e.push('history must be a list')
  else {
    for (const h of row.history as unknown[]) {
      if (!isRecord(h) || !isNum(h.at) || !isStr(h.from) || !isStr(h.to) || !statuses.includes(h.from) || !statuses.includes(h.to)) {
        e.push('history contains an invalid entry')
        break
      }
    }
  }
  return e
}
