import { describe, expect, it } from 'vitest'
import { DAY_MS, isBackupDue } from './reminder'

const base = { now: 100 * DAY_MS, lastBackupAt: null, reminderDays: 14, snoozedUntil: 0, oldestProfileCreatedAt: null }

describe('isBackupDue', () => {
  it('is off when disabled or with no data to protect', () => {
    expect(isBackupDue({ ...base, reminderDays: 0, oldestProfileCreatedAt: 0 })).toBe(false)
    expect(isBackupDue(base)).toBe(false)
  })
  it('measures from the last backup, else from the oldest profile', () => {
    expect(isBackupDue({ ...base, lastBackupAt: 90 * DAY_MS })).toBe(false)
    expect(isBackupDue({ ...base, lastBackupAt: 86 * DAY_MS })).toBe(true)
    expect(isBackupDue({ ...base, oldestProfileCreatedAt: 50 * DAY_MS })).toBe(true)
  })
  it('respects snooze', () => {
    expect(isBackupDue({ ...base, lastBackupAt: 0, snoozedUntil: 101 * DAY_MS })).toBe(false)
  })
})
