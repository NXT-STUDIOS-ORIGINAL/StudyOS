import type { BackupFile, Row } from './format'

export type ProfileAction =
  | { type: 'skip' }
  | { type: 'create' }
  | { type: 'merge'; targetId: string }
  | { type: 'replace'; targetId: string }

/** How to resolve a record that exists in both places with different content. */
export type ConflictPolicy = 'keep-existing' | 'use-backup' | 'newer'

export interface RestorePlan {
  actions: Record<string, ProfileAction> // keyed by the backup's profile ID
  policy: ConflictPolicy
}

export interface RestoreReport {
  created: number
  merged: number
  replaced: number
  skipped: number
  rowsAdded: number
  rowsOverwritten: number
  rowsKept: number
  rowsIdentical: number
}

export const emptyReport = (): RestoreReport => ({
  created: 0, merged: 0, replaced: 0, skipped: 0,
  rowsAdded: 0, rowsOverwritten: 0, rowsKept: 0, rowsIdentical: 0,
})

/** Same ID already on this device → merge (shown to the user, never applied unseen). Otherwise create. */
export function defaultPlan(backup: BackupFile, existingIds: ReadonlySet<string>): RestorePlan {
  const actions: Record<string, ProfileAction> = {}
  for (const e of backup.profiles) {
    actions[e.profile.id] = existingIds.has(e.profile.id)
      ? { type: 'merge', targetId: e.profile.id }
      : { type: 'create' }
  }
  return { actions, policy: 'keep-existing' }
}

export function checkPlan(backup: BackupFile, plan: RestorePlan, existingIds: ReadonlySet<string>): string[] {
  const errors: string[] = []
  const targets = new Set<string>()
  let active = 0
  for (const e of backup.profiles) {
    const action = plan.actions[e.profile.id]
    const name = e.profile.displayName
    if (!action) { errors.push(`No action chosen for “${name}”.`); continue }
    if (action.type === 'skip') continue
    active++
    if (action.type === 'merge' || action.type === 'replace') {
      if (!existingIds.has(action.targetId)) errors.push(`The profile chosen for “${name}” no longer exists.`)
      if (targets.has(action.targetId)) errors.push('Two backup profiles cannot be restored into the same profile.')
      targets.add(action.targetId)
    }
  }
  if (active === 0) errors.push('Nothing is selected to restore.')
  return errors
}

export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

export type Resolution = 'identical' | 'keep' | 'use-backup'

/**
 * Conflict policy for one record present on both sides (matched by stable ID):
 * - identical content → nothing to do
 * - keep-existing → existing wins
 * - use-backup → backup wins
 * - newer → the record with the larger updatedAt wins; ties or missing timestamps keep existing
 */
export function resolveConflict(existing: Row, incoming: Row, policy: ConflictPolicy): Resolution {
  if (stableStringify(existing) === stableStringify(incoming)) return 'identical'
  if (policy === 'use-backup') return 'use-backup'
  if (policy === 'newer') {
    const a = existing.updatedAt
    const b = incoming.updatedAt
    if (typeof a === 'number' && typeof b === 'number' && b > a) return 'use-backup'
  }
  return 'keep'
}
