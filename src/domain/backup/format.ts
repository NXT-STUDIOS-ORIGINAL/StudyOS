import type { Avatar, Profile } from '../types'
import { toProfileDraft, validateProfileDraft } from '../profile'
import { isNum, isRecord, isStr } from './guards'
import { BACKUP_TABLES } from './tables'

export { BACKUP_TABLES } from './tables'
export type { BackupTableSpec } from './tables'

export const BACKUP_FORMAT = 'studyos-backup'
export const BACKUP_SCHEMA_VERSION = 1
export const APP_VERSION = '0.1.0'
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024
const MAX_ERRORS = 20
const MAX_PROFILES = 100

export type Row = Record<string, unknown>

export interface BackupProfileEntry {
  profile: Profile
  tables: Record<string, Row[]>
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  schemaVersion: number
  exportedAt: string // ISO 8601
  appVersion: string
  scope: 'profile' | 'all'
  profiles: BackupProfileEntry[]
}

export interface BackupSummary {
  scope: 'profile' | 'all'
  exportedAt: string
  schemaVersion: number
  appVersion: string
  profiles: { id: string; displayName: string; counts: Record<string, number> }[]
}

export type BackupValidation =
  | { ok: true; backup: BackupFile; summary: BackupSummary }
  | { ok: false; errors: string[] }

function parseProfile(p: unknown): { profile: Profile | null; errors: string[] } {
  if (!isRecord(p)) return { profile: null, errors: ['profile details are missing'] }
  const strKeys = ['displayName', 'nickname', 'board', 'classGrade', 'academicYear', 'schoolName'] as const
  const errors: string[] = []
  if (!isStr(p.id) || p.id.length === 0) errors.push('profile ID is missing')
  for (const k of strKeys) {
    if (!isStr(p[k])) errors.push(`${k} must be text`)
  }
  if (!isNum(p.createdAt)) errors.push('createdAt must be a number')
  if (!isNum(p.lastActiveAt)) errors.push('lastActiveAt must be a number')
  let avatar: Avatar | null = null
  if (isRecord(p.avatar)) {
    if (p.avatar.kind === 'default' && isStr(p.avatar.key)) {
      avatar = { kind: 'default', key: p.avatar.key }
    } else if (p.avatar.kind === 'image' && isStr(p.avatar.dataUrl)) {
      avatar = { kind: 'image', dataUrl: p.avatar.dataUrl }
    }
  }
  if (!avatar) errors.push('avatar is invalid')
  if (errors.length > 0 || !avatar) return { profile: null, errors }
  const profile: Profile = {
    id: p.id as string,
    displayName: p.displayName as string,
    nickname: p.nickname as string,
    board: p.board as string,
    classGrade: p.classGrade as string,
    academicYear: p.academicYear as string,
    schoolName: p.schoolName as string,
    avatar,
    createdAt: p.createdAt as number,
    lastActiveAt: p.lastActiveAt as number,
  }
  const content = validateProfileDraft(toProfileDraft(profile))
  return content.length > 0 ? { profile: null, errors: content } : { profile, errors: [] }
}

export function validateBackup(raw: unknown): BackupValidation {
  const errors: string[] = []
  let overflow = 0
  const add = (m: string) => {
    if (errors.length < MAX_ERRORS) errors.push(m)
    else overflow++
  }
  const failed = (): BackupValidation => ({
    ok: false,
    errors: overflow > 0 ? [...errors, `…and ${overflow} more problem(s).`] : errors,
  })

  if (!isRecord(raw)) {
    add('The file does not contain a StudyOS backup.')
    return failed()
  }
  if (raw.format !== BACKUP_FORMAT) {
    add('This is not a StudyOS backup file (format identifier missing or different).')
    return failed()
  }
  const version = raw.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    add('The backup has no valid format version.')
    return failed()
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    add(
      `This backup uses format version ${version}, which is newer than this app supports ` +
        `(${BACKUP_SCHEMA_VERSION}). Update StudyOS and try again.`,
    )
    return failed()
  }
  // Older versions would be migrated to the current shape here.

  if (!isStr(raw.exportedAt) || Number.isNaN(Date.parse(raw.exportedAt))) {
    add('The export date is missing or invalid.')
  }
  if (raw.scope !== 'profile' && raw.scope !== 'all') {
    add('The backup scope must be "profile" or "all".')
  }
  if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) {
    add('The backup contains no profiles.')
    return failed()
  }
  if (raw.profiles.length > MAX_PROFILES) {
    add(`Too many profiles (limit ${MAX_PROFILES}).`)
    return failed()
  }
  if (raw.scope === 'profile' && raw.profiles.length !== 1) {
    add('A single-profile backup must contain exactly one profile.')
  }

  const seenProfiles = new Set<string>()
  const seenRows = new Set<string>()
  const entries: BackupProfileEntry[] = []

  raw.profiles.forEach((item: unknown, i: number) => {
    const label = `Profile ${i + 1}`
    if (!isRecord(item)) {
      add(`${label} is not an object.`)
      return
    }
    const parsed = parseProfile(item.profile)
    if (!parsed.profile) {
      parsed.errors.forEach((e) => add(`${label}: ${e}.`))
      return
    }
    const profile = parsed.profile
    const name = profile.displayName
    if (seenProfiles.has(profile.id)) {
      add(`Duplicate profile ID in the file (${profile.id}).`)
      return
    }
    seenProfiles.add(profile.id)

    if (item.tables !== undefined && !isRecord(item.tables)) {
      add(`"${name}": data section is malformed.`)
      return
    }
    const tablesIn: Record<string, unknown> = item.tables ?? {}
    for (const key of Object.keys(tablesIn)) {
      if (!BACKUP_TABLES.some((t) => t.name === key)) add(`"${name}" contains unknown data "${key}".`)
    }

    const tables: Record<string, Row[]> = {}
    for (const spec of BACKUP_TABLES) {
      const rows = tablesIn[spec.name]
      if (rows === undefined) {
        tables[spec.name] = []
        continue
      }
      if (!Array.isArray(rows)) {
        add(`"${name}": ${spec.name} must be a list.`)
        continue
      }
      const valid: Row[] = []
      rows.forEach((row: unknown, r: number) => {
        const problems = spec.validateRow(row, profile.id)
        if (problems.length > 0) {
          problems.forEach((p) => add(`"${name}" ${spec.name}[${r}]: ${p}.`))
          return
        }
        const rec = row as Row
        const key = `${spec.name}:${String(rec[spec.pk])}`
        if (seenRows.has(key)) {
          add(`Duplicate record ID in the file (${key}).`)
          return
        }
        seenRows.add(key)
        if (spec.unique) {
          const fields = spec.unique.map((f) => String(rec[f])).join('|')
          const composite = `${spec.name}:${profile.id}:${fields}`
          if (seenRows.has(composite)) {
            add(`Duplicate ${spec.label} for the same item in "${name}".`)
            return
          }
          seenRows.add(composite)
        }
        valid.push(rec)
      })
      tables[spec.name] = valid
    }

    for (const spec of BACKUP_TABLES) {
      for (const ref of spec.refs) {
        if (ref.soft) continue
        const known = new Set((tables[ref.table] ?? []).map((r) => String(r.id)))
        for (const row of tables[spec.name] ?? []) {
          if (row[ref.field] !== null && !known.has(String(row[ref.field]))) {
            add(
              `"${name}": a ${spec.label} refers to a missing record in ${ref.table} ` +
                `(${String(row[ref.field])}).`,
            )
          }
        }
      }
    }
    entries.push({ profile, tables })
  })

  if (errors.length > 0 || overflow > 0) return failed()
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    schemaVersion: version,
    exportedAt: raw.exportedAt as string,
    appVersion: isStr(raw.appVersion) ? raw.appVersion : 'unknown',
    scope: raw.scope as 'profile' | 'all',
    profiles: entries,
  }
  return { ok: true, backup, summary: summarizeBackup(backup) }
}

export function summarizeBackup(b: BackupFile): BackupSummary {
  return {
    scope: b.scope,
    exportedAt: b.exportedAt,
    schemaVersion: b.schemaVersion,
    appVersion: b.appVersion,
    profiles: b.profiles.map((e) => ({
      id: e.profile.id,
      displayName: e.profile.displayName,
      counts: Object.fromEntries(BACKUP_TABLES.map((t) => [t.name, e.tables[t.name]?.length ?? 0])),
    })),
  }
}

export function describeCounts(counts: Record<string, number>): string {
  const parts = BACKUP_TABLES.filter((t) => (counts[t.name] ?? 0) > 0).map((t) => {
    const n = counts[t.name] ?? 0
    return `${n} ${t.label}${n === 1 ? '' : 's'}`
  })
  return parts.length > 0 ? parts.join(', ') : 'No records'
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
    }
