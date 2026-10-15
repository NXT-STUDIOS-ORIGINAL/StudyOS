import { describe, expect, it } from 'vitest'
import { appendHistory, validateActivityTypeDraft } from './rules'
import { MAX_HISTORY } from './types'

describe('validateActivityTypeDraft', () => {
  const ok = { name: 'Theory', enabled: true, weight: null, role: 'study' as const }
  it('accepts valid drafts including an empty weight', () => {
    expect(validateActivityTypeDraft(ok)).toEqual([])
    expect(validateActivityTypeDraft({ ...ok, weight: 2.5 })).toEqual([])
  })
  it('rejects empty names, bad weights and unknown roles', () => {
    expect(validateActivityTypeDraft({ ...ok, name: '  ' })).not.toEqual([])
    expect(validateActivityTypeDraft({ ...ok, weight: 0 })).not.toEqual([])
    expect(validateActivityTypeDraft({ ...ok, weight: NaN })).not.toEqual([])
    expect(validateActivityTypeDraft({ ...ok, role: 'nope' as never })).not.toEqual([])
  })
})

describe('appendHistory', () => {
  it('appends and caps the history, dropping the oldest', () => {
    let h = [] as ReturnType<typeof appendHistory>
    for (let i = 0; i < MAX_HISTORY + 5; i++) h = appendHistory(h, { at: i, from: 'todo', to: 'done' })
    expect(h).toHaveLength(MAX_HISTORY)
    expect(h[0].at).toBe(5)
  })
})
