import type { ActivityRole, ActivityType } from './types'

export interface DefaultActivity { key: string; name: string; role: ActivityRole; weight: number; compact: boolean }

/** Starting suggestions only. Every one can be renamed, reweighted, hidden from the card, archived or deleted. */
export const DEFAULT_ACTIVITY_SET: DefaultActivity[] = [
  { key: 'theory', name: 'Theory', role: 'study', weight: 1, compact: true },
  { key: 'notes', name: 'Notes', role: 'study', weight: 0.5, compact: false },
  { key: 'practice', name: 'Question Practice', role: 'practice', weight: 2, compact: true },
  { key: 'extra', name: 'Extra Questions / Question Bank', role: 'practice', weight: 1, compact: true },
  { key: 'pyq', name: 'PYQs', role: 'practice', weight: 2, compact: true },
  { key: 'rev1', name: 'Revision 1', role: 'revision', weight: 1, compact: true },
  { key: 'rev2', name: 'Revision 2', role: 'revision', weight: 1, compact: false },
  { key: 'rev3', name: 'Revision 3', role: 'revision', weight: 1, compact: false },
  { key: 'selftest', name: 'Self-Test', role: 'test', weight: 2, compact: false },
  { key: 'mistakes', name: 'Mistake Correction', role: 'correction', weight: 1, compact: false },
]

export const DEFAULT_ACTIVITY_NAMES = new Set(DEFAULT_ACTIVITY_SET.map((d) => d.name))
export const COMPACT_DEFAULT_NAMES = new Set(DEFAULT_ACTIVITY_SET.filter((d) => d.compact).map((d) => d.name))

export function buildActivityTypes(
  profileId: string, subjectId: string | null, now: number,
): { key: string; row: ActivityType }[] {
  return DEFAULT_ACTIVITY_SET.map((d, i) => ({
    key: d.key,
    row: {
      id: crypto.randomUUID(), profileId, subjectId, name: d.name, order: i, enabled: true,
      weight: d.weight, role: d.role, showInCompact: d.compact, createdAt: now, updatedAt: now,
    },
  }))
}
