import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseIntervals, validateSettings } from './settings'

describe('parseIntervals', () => {
  it('parses a valid list', () => {
    expect(parseIntervals('1, 3, 7, 14, 30')).toEqual([1, 3, 7, 14, 30])
  })
  it('rejects non-increasing, zero, decimals and empty input', () => {
    expect(parseIntervals('3, 1')).toBeNull()
    expect(parseIntervals('0, 2')).toBeNull()
    expect(parseIntervals('1.5, 3')).toBeNull()
    expect(parseIntervals('')).toBeNull()
  })
})

describe('validateSettings', () => {
  it('accepts the defaults', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual([])
  })
  it('flags bad values', () => {
    const errs = validateSettings({ ...DEFAULT_SETTINGS, dailyTargetMinutes: NaN, preferredDays: [] })
    expect(errs.length).toBe(2)
  })
})
