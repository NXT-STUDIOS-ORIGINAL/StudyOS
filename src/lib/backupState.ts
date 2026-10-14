import { db } from './db'
import { DAY_MS } from '../domain/backup/reminder'

const LAST = 'lastBackupAt'
const DAYS = 'backupReminderDays'
const SNOOZE = 'backupSnoozedUntil'
export const DEFAULT_REMINDER_DAYS = 14

export interface BackupStatus {
  lastBackupAt: number | null
  reminderDays: number
  snoozedUntil: number
  oldestProfileCreatedAt: number | null
}

export async function setLastBackupNow(): Promise<void> {
  await db.appState.put({ key: LAST, value: new Date().toISOString() })
}
export async function setReminderDays(days: number): Promise<void> {
  await db.appState.put({ key: DAYS, value: String(days) })
}
export async function snoozeReminder(ms: number = DAY_MS): Promise<void> {
  await db.appState.put({ key: SNOOZE, value: String(Date.now() + ms) })
}

export async function readBackupStatus(): Promise<BackupStatus> {
  const [rows, profiles] = await Promise.all([
    db.appState.bulkGet([LAST, DAYS, SNOOZE]),
    db.profiles.toArray(),
  ])
  const [last, days, snooze] = rows
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v)
    return v !== undefined && Number.isFinite(n) ? n : fallback
  }
  const lastParsed = last ? Date.parse(last.value) : NaN
  return {
    lastBackupAt: Number.isNaN(lastParsed) ? null : lastParsed,
    reminderDays: num(days?.value, DEFAULT_REMINDER_DAYS),
    snoozedUntil: num(snooze?.value, 0),
    oldestProfileCreatedAt: profiles.length > 0 ? Math.min(...profiles.map((p) => p.createdAt)) : null,
  }
}
