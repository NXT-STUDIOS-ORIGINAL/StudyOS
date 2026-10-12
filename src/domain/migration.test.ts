import { describe, expect, it } from 'vitest'
import { legacyToProfile } from './migration'

describe('legacyToProfile', () => {
  it('returns null when v1 was never onboarded or missing', () => {
    expect(legacyToProfile(undefined, 'x', 1)).toBeNull()
    expect(legacyToProfile({ id: 'main', onboarded: false }, 'x', 1)).toBeNull()
  })
  it('maps fields and derives the weekly target', () => {
    const r = legacyToProfile(
      { id: 'main', onboarded: true, name: ' Asha ', boardClass: 'CBSE 10', academicYear: '2026-27',
        dailyTargetMinutes: 240, preferredDays: [1, 2, 3], theme: 'dark' },
      'p1', 5,
    )
    expect(r?.profile.id).toBe('p1')
    expect(r?.profile.displayName).toBe('Asha')
    expect(r?.profile.board).toBe('CBSE 10')
    expect(r?.settings.profileId).toBe('p1')
    expect(r?.settings.weeklyTargetMinutes).toBe(720)
    expect(r?.settings.theme).toBe('dark')
  })
  it('falls back to defaults for bad values', () => {
    const r = legacyToProfile({ id: 'main', onboarded: true, focusMinutes: NaN, revisionIntervals: [] }, 'p', 1)
    expect(r?.profile.displayName).toBe('My profile')
    expect(r?.settings.focusMinutes).toBe(25)
    expect(r?.settings.revisionIntervals).toEqual([1, 3, 7, 14, 30])
  })
})
