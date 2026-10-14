export const DAY_MS = 86_400_000

export interface ReminderInput {
  now: number
  lastBackupAt: number | null
  reminderDays: number // 0 = off
  snoozedUntil: number
  oldestProfileCreatedAt: number | null
}

export function isBackupDue(i: ReminderInput): boolean {
  if (i.reminderDays <= 0 || i.now < i.snoozedUntil) return false
  const since = i.lastBackupAt ?? i.oldestProfileCreatedAt
  if (since === null) return false
  return i.now - since >= i.reminderDays * DAY_MS
}
