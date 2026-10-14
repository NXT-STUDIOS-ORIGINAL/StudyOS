import { describe, expect, it } from 'vitest'
import { checkPlan, defaultPlan, resolveConflict, stableStringify } from './plan'
import type { BackupFile } from './format'

const entry = (id: string) => ({
  profile: { id, displayName: id, nickname: '', board: '', classGrade: '', academicYear: '', schoolName: '',
    avatar: { kind: 'default' as const, key: 'indigo' }, createdAt: 1, lastActiveAt: 1 },
  tables: {},
})
const backup = (...ids: string[]): BackupFile => ({
  format: 'studyos-backup', schemaVersion: 1, exportedAt: '2026-01-01T00:00:00Z', appVersion: '0.1.0',
  scope: 'all', profiles: ids.map(entry),
})

describe('defaultPlan', () => {
  it('merges known ids and creates unknown ones', () => {
    const p = defaultPlan(backup('a', 'b'), new Set(['a']))
    expect(p.actions.a).toEqual({ type: 'merge', targetId: 'a' })
    expect(p.actions.b).toEqual({ type: 'create' })
    expect(p.policy).toBe('keep-existing')
  })
})

describe('checkPlan', () => {
  it('accepts a sensible plan', () => {
    expect(checkPlan(backup('a'), defaultPlan(backup('a'), new Set()), new Set())).toEqual([])
  })
  it('rejects empty, unknown-target and shared-target plans', () => {
    const b = backup('a', 'b')
    expect(checkPlan(b, { actions: { a: { type: 'skip' }, b: { type: 'skip' } }, policy: 'keep-existing' }, new Set())).not.toEqual([])
    expect(checkPlan(b, { actions: { a: { type: 'merge', targetId: 'x' }, b: { type: 'skip' } }, policy: 'keep-existing' }, new Set())).not.toEqual([])
    expect(checkPlan(b, { actions: { a: { type: 'merge', targetId: 'x' }, b: { type: 'replace', targetId: 'x' } }, policy: 'keep-existing' }, new Set(['x']))).not.toEqual([])
    expect(checkPlan(b, { actions: { a: { type: 'create' } }, policy: 'keep-existing' }, new Set())).not.toEqual([])
  })
})

describe('resolveConflict', () => {
  const a = { profileId: 'p', v: 1, updatedAt: 5 }
  const newer = { profileId: 'p', v: 2, updatedAt: 9 }
  it('detects identical records regardless of key order', () => {
    expect(resolveConflict(a, { updatedAt: 5, v: 1, profileId: 'p' }, 'use-backup')).toBe('identical')
  })
  it('applies each policy', () => {
    expect(resolveConflict(a, newer, 'keep-existing')).toBe('keep')
    expect(resolveConflict(a, newer, 'use-backup')).toBe('use-backup')
    expect(resolveConflict(a, newer, 'newer')).toBe('use-backup')
    expect(resolveConflict(newer, a, 'newer')).toBe('keep')
    expect(resolveConflict({ v: 1 }, { v: 2 }, 'newer')).toBe('keep')
  })
})

describe('stableStringify', () => {
  it('sorts keys deeply', () => {
    expect(stableStringify({ b: [{ y: 1, x: 2 }], a: 1 })).toBe('{"a":1,"b":[{"x":2,"y":1}]}')
  })
})
