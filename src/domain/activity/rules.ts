import { ACTIVITY_ROLES, MAX_ACTIVITY_NAME, MAX_HISTORY, type ActivityTypeDraft, type HistoryEntry } from './types'

export function validateActivityTypeDraft(d: ActivityTypeDraft): string[] {
  const errs: string[] = []
  const name = d.name.trim()
  if (name.length === 0) errs.push('Activity name is required.')
  if (name.length > MAX_ACTIVITY_NAME) errs.push(`Activity name must be ${MAX_ACTIVITY_NAME} characters or fewer.`)
  if (d.weight !== null && !(Number.isFinite(d.weight) && d.weight > 0 && d.weight <= 100))
    errs.push('Weight must be a number above 0 (up to 100), or left empty.')
  if (!ACTIVITY_ROLES.includes(d.role)) errs.push('Unknown role.')
  return errs
}

export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...history, entry]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}
