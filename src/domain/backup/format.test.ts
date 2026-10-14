import { describe, expect, it } from 'vitest'
import { describeCounts, validateBackup } from './format'
import { DEFAULT_SETTINGS } from '../settings'

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const prof = (id: string, name = 'Asha') => ({
  id, displayName: name, nickname: '', board: '', classGrade: '', academicYear: '', schoolName: '',
  avatar: { kind: 'default', key: 'indigo' }, createdAt: 1, lastActiveAt: 2,
})
const settings = (pid: string) => ({ profileId: pid, ...DEFAULT_SETTINGS, updatedAt: 10 })
const valid = (): Record<string, unknown> => ({
  format: 'studyos-backup', schemaVersion: 1, exportedAt: '2026-10-13T10:00:00.000Z',
  appVersion: '0.1.0', scope: 'all',
  profiles: [{ profile: prof('a'), tables: { profileSettings: [settings('a')] } }],
})
const errorsOf = (raw: unknown) => {
  const r = validateBackup(raw)
  return r.ok ? [] : r.errors
}

describe('validateBackup', () => {
  it('accepts a valid backup and summarises it', () => {
    const r = validateBackup(valid())
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.summary.profiles[0].counts.profileSettings).toBe(1)
      expect(describeCounts(r.summary.profiles[0].counts)).toBe('1 settings record')
    }
  })
  it('rejects non-objects and wrong formats', () => {
    expect(errorsOf(null)).not.toEqual([])
    expect(errorsOf([])).not.toEqual([])
    expect(errorsOf({ ...valid(), format: 'other' })).not.toEqual([])
  })
  it('rejects unsupported and invalid versions', () => {
    expect(errorsOf({ ...valid(), schemaVersion: 99 }).join(' ')).toMatch(/newer/)
    expect(errorsOf({ ...valid(), schemaVersion: 0 })).not.toEqual([])
    expect(errorsOf({ ...valid(), schemaVersion: '1' })).not.toEqual([])
  })
  it('rejects bad scope, dates and empty profile lists', () => {
    expect(errorsOf({ ...valid(), scope: 'everything' })).not.toEqual([])
    expect(errorsOf({ ...valid(), exportedAt: 'nope' })).not.toEqual([])
    expect(errorsOf({ ...valid(), profiles: [] })).not.toEqual([])
  })
  it('rejects a single-profile scope holding two profiles', () => {
    const b = valid()
    b.scope = 'profile'
    ;(b.profiles as unknown[]).push({ profile: prof('b'), tables: {} })
    expect(errorsOf(b)).not.toEqual([])
  })
  it('detects duplicate profile ids', () => {
    const b = valid()
    ;(b.profiles as unknown[]).push({ profile: prof('a', 'Dup'), tables: {} })
    expect(errorsOf(b).join(' ')).toMatch(/Duplicate profile ID/)
  })
  it('detects duplicate records, wrong owners and unknown tables', () => {
    const dup = clone(valid())
    ;(dup.profiles as { tables: { profileSettings: unknown[] } }[])[0].tables.profileSettings.push(settings('a'))
    expect(errorsOf(dup).join(' ')).toMatch(/Duplicate record/)

    const wrongOwner = clone(valid())
    ;(wrongOwner.profiles as { tables: { profileSettings: unknown[] } }[])[0].tables.profileSettings = [settings('zzz')]
    expect(errorsOf(wrongOwner).join(' ')).toMatch(/different profile/)

    const unknown = clone(valid())
    ;(unknown.profiles as { tables: Record<string, unknown> }[])[0].tables.mystery = []
    expect(errorsOf(unknown).join(' ')).toMatch(/unknown data/)
  })
  it('rejects malformed profiles and settings values', () => {
    const noName = clone(valid())
    ;(noName.profiles as { profile: { displayName: string } }[])[0].profile.displayName = ''
    expect(errorsOf(noName)).not.toEqual([])

    const badSettings = clone(valid())
    ;(badSettings.profiles as { tables: { profileSettings: Record<string, unknown>[] } }[])[0]
      .tables.profileSettings[0].focusMinutes = 'long'
    expect(errorsOf(badSettings)).not.toEqual([])
  })
  it('rejects avatars that are not safe JPEG data URLs', () => {
    const b = clone(valid())
    ;(b.profiles as { profile: { avatar: unknown } }[])[0].profile.avatar = { kind: 'image', dataUrl: 'data:text/html;base64,AAAA' }
    expect(errorsOf(b)).not.toEqual([])
  })
})
