import type { IndexableType } from 'dexie'
import { format } from 'date-fns'
import { ACTIVE_KEY, db } from './db'
import { setLastBackupNow } from './backupState'
import { toProfileDraft } from '../domain/profile'
import {
  APP_VERSION, BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, BACKUP_TABLES, summarizeBackup,
  type BackupFile, type BackupProfileEntry, type BackupSummary, type Row,
} from '../domain/backup/format'
import {
  checkPlan, emptyReport, resolveConflict,
  type ConflictPolicy, type RestorePlan, type RestoreReport,
} from '../domain/backup/plan'

export type ExportScope = { kind: 'profile'; id: string } | { kind: 'all' }

/** Reads a consistent snapshot of the chosen profiles and everything they own. */
export async function buildBackup(scope: ExportScope): Promise<BackupFile> {
  return db.transaction('r', db.tables, async () => {
    const all = (await db.profiles.toArray()).sort((a, b) => a.createdAt - b.createdAt)
    const chosen = scope.kind === 'all' ? all : all.filter((p) => p.id === scope.id)
    if (chosen.length === 0) throw new Error('Nothing to export: that profile was not found.')
    const profiles: BackupProfileEntry[] = []
    for (const profile of chosen) {
      const tables: Record<string, Row[]> = {}
      for (const spec of BACKUP_TABLES) {
        tables[spec.name] = (await db.table(spec.name).where('profileId').equals(profile.id).toArray()) as Row[]
      }
      profiles.push({ profile, tables })
    }
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      scope: scope.kind === 'all' ? 'all' : 'profile',
      profiles,
    } satisfies BackupFile
  })
}

export function backupFileName(b: BackupFile): string {
  const stamp = format(new Date(b.exportedAt), 'yyyyMMdd-HHmm')
  if (b.scope === 'all') return `studyos-backup-all-${stamp}.json`
  const slug = b.profiles[0].profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `studyos-backup-${slug || 'profile'}-${stamp}.json`
}

function triggerDownload(fileName: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface ExportResult { fileName: string; sizeBytes: number; summary: BackupSummary }

export async function exportAndDownload(scope: ExportScope): Promise<ExportResult> {
  const backup = await buildBackup(scope)
  const json = JSON.stringify(backup)
  const fileName = backupFileName(backup)
  triggerDownload(fileName, json)
  await setLastBackupNow()
  return { fileName, sizeBytes: new Blob([json]).size, summary: summarizeBackup(backup) }
}

/**
 * mode "add": rows are new for this profile. A row whose ID already exists anywhere on this
 *   device gets a fresh ID, and rows that reference it are re-pointed (parents are processed first).
 * mode "merge": rows are matched by stable ID and resolved by the conflict policy.
 */
async function importRows(
  entry: BackupProfileEntry, targetId: string, mode: 'add' | 'merge',
  policy: ConflictPolicy, report: RestoreReport,
): Promise<void> {
  const idMap = new Map<string, Map<string, string>>()
  for (const spec of BACKUP_TABLES) {
    const table = db.table(spec.name)
    const remaps = new Map<string, string>()
    idMap.set(spec.name, remaps)
    for (const row of entry.tables[spec.name] ?? []) {
      const incoming: Row = { ...row, profileId: targetId }

      if (mode === 'add') {
        for (const ref of spec.refs) {
          const mapped = idMap.get(ref.table)?.get(String(incoming[ref.field]))
          if (mapped) incoming[ref.field] = mapped
        }
        if (spec.pk !== 'profileId') {
          const oldId = String(incoming[spec.pk])
          if (await table.get(incoming[spec.pk] as IndexableType)) {
            const fresh = crypto.randomUUID()
            remaps.set(oldId, fresh)
            incoming[spec.pk] = fresh
          }
        }
        await table.add(incoming)
        report.rowsAdded++
        continue
      }

      const key = incoming[spec.pk] as IndexableType
      const existing = (await table.get(key)) as Row | undefined
      if (!existing) {
        await table.add(incoming)
        report.rowsAdded++
        continue
      }
      if (existing.profileId !== targetId)
        throw new Error(`Record ${String(key)} in ${spec.name} already belongs to another profile.`)
      const outcome = resolveConflict(existing, incoming, policy)
      if (outcome === 'identical') report.rowsIdentical++
      else if (outcome === 'keep') report.rowsKept++
      else {
        await table.put(incoming)
        report.rowsOverwritten++
      }
    }
  }
}

/**
 * Applies a restore plan in ONE transaction: any error (including one thrown by onProgress)
 * aborts and rolls back every change made so far.
 */
export async function restoreBackup(
  backup: BackupFile,
  plan: RestorePlan,
  onProgress?: (done: number, total: number) => void,
): Promise<RestoreReport> {
  return db.transaction('rw', db.tables, async () => {
    const existing = new Set<string>((await db.profiles.toCollection().primaryKeys()) as string[])
    const problems = checkPlan(backup, plan, existing)
    if (problems.length > 0) throw new Error(problems.join(' '))

    const report = emptyReport()
    const total = backup.profiles.filter((e) => plan.actions[e.profile.id]?.type !== 'skip').length
    let done = 0
    let touched: string | null = null

    for (const entry of backup.profiles) {
      const action = plan.actions[entry.profile.id]
      if (!action || action.type === 'skip') { report.skipped++; continue }

      if (action.type === 'create') {
        const id = existing.has(entry.profile.id) ? crypto.randomUUID() : entry.profile.id
        existing.add(id)
        await db.profiles.add({ ...entry.profile, id })
        await importRows(entry, id, 'add', plan.policy, report)
        report.created++
        touched ??= id
      } else if (action.type === 'replace') {
        const current = await db.profiles.get(action.targetId)
        if (!current) throw new Error('The profile to replace no longer exists.')
        for (const spec of BACKUP_TABLES) {
          await db.table(spec.name).where('profileId').equals(action.targetId).delete()
        }
        await db.profiles.put({
          ...entry.profile, id: action.targetId,
          createdAt: current.createdAt, lastActiveAt: current.lastActiveAt,
        })
        await importRows(entry, action.targetId, 'add', plan.policy, report)
        report.replaced++
        touched ??= action.targetId
      } else {
        if (plan.policy === 'use-backup') await db.profiles.update(action.targetId, toProfileDraft(entry.profile))
        await importRows(entry, action.targetId, 'merge', plan.policy, report)
        report.merged++
        touched ??= action.targetId
      }
      done++
      onProgress?.(done, total)
    }

    if (touched && !(await db.appState.get(ACTIVE_KEY))) {
      await db.appState.put({ key: ACTIVE_KEY, value: touched })
    }
    return report
  })
  }
