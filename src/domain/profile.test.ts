import { describe, expect, it } from 'vitest'
import { emptyProfileDraft, initials, validateAvatarFile, validateProfileDraft } from './profile'

describe('validateAvatarFile', () => {
  it('accepts a small png', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1000 })).toBeNull()
  })
  it('rejects wrong type, empty and oversized files', () => {
    expect(validateAvatarFile({ type: 'image/gif', size: 1000 })).not.toBeNull()
    expect(validateAvatarFile({ type: 'image/png', size: 0 })).not.toBeNull()
    expect(validateAvatarFile({ type: 'image/png', size: 6 * 1024 * 1024 })).not.toBeNull()
  })
})

describe('validateProfileDraft', () => {
  it('requires a display name', () => {
    expect(validateProfileDraft(emptyProfileDraft())).toContain('Display name is required.')
  })
  it('accepts a minimal valid profile', () => {
    expect(validateProfileDraft({ ...emptyProfileDraft(), displayName: 'Asha' })).toEqual([])
  })
  it('rejects bad avatars', () => {
    const base = { ...emptyProfileDraft(), displayName: 'A' }
    expect(validateProfileDraft({ ...base, avatar: { kind: 'default', key: 'nope' } })).not.toEqual([])
    expect(validateProfileDraft({ ...base, avatar: { kind: 'image', dataUrl: 'data:text/html;base64,AAA' } })).not.toEqual([])
  })
})

describe('initials', () => {
  it('builds initials', () => {
    expect(initials('Asha Rao')).toBe('AR')
    expect(initials('asha')).toBe('A')
    expect(initials('  ')).toBe('?')
  })
})
