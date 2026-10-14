import { useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { exportAndDownload, restoreBackup } from '../../lib/backup'
import {
  describeCounts, MAX_BACKUP_BYTES, validateBackup, type BackupFile, type BackupSummary,
} from '../../domain/backup/format'
import {
  checkPlan, defaultPlan, type ConflictPolicy, type ProfileAction, type RestorePlan, type RestoreReport,
} from '../../domain/backup/plan'
import { Avatar } from '../Avatar'
import { ConfirmDialog } from '../ConfirmDialog'
import { BackupSummaryView } from './BackupSummaryView'
import { fieldCls, primaryBtn, secondaryBtn } from '../ui'

type Stage =
  | { kind: 'idle' }
  | { kind: 'invalid'; fileName: string; errors: string[] }
  | { kind: 'preview'; fileName: string; sizeBytes: number; backup: BackupFile; summary: BackupSummary }
  | { kind: 'done'; report: RestoreReport }

const toValue = (a: ProfileAction): string =>
  a.type === 'create' || a.type === 'skip' ? a.type : `${a.type}:${a.targetId}`

function fromValue(v: string): ProfileAction {
  if (v === 'skip') return { type: 'skip' }
  if (v === 'create') return { type: 'create' }
  const [type, ...rest] = v.split(':')
  const targetId = rest.join(':')
  return type === 'replace' ? { type: 'replace', targetId } : { type: 'merge', targetId }
}

function reportText(r: RestoreReport): string {
  const parts: string[] = []
  if (r.created) parts.push(`${r.created} profile(s) created`)
  if (r.merged) parts.push(`${r.merged} merged`)
  if (r.replaced) parts.push(`${r.replaced} replaced`)
  if (r.skipped) parts.push(`${r.skipped} skipped`)
  parts.push(`${r.rowsAdded} records added, ${r.rowsOverwritten} overwritten, ${r.rowsKept} kept as they were, ${r.rowsIdentical} already identical`)
  return parts.join('; ')
}

export function RestoreSection() {
  const profiles = useLiveQuery(() => db.profiles.toArray(), []) ?? []
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [preMsg, setPreMsg] = useState<string | null>(null)

  const existingIds = new Set(profiles.map((p) => p.id))

  function reset() {
    setStage({ kind: 'idle' })
    setPlan(null)
    setError(null)
    setProgress(null)
    setPreMsg(null)
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    reset()
    const invalid = (errors: string[]) => setStage({ kind: 'invalid', fileName: file.name, errors })
    if (file.size > MAX_BACKUP_BYTES) return invalid(['The file is larger than 50 MB, so it is not a normal StudyOS backup.'])
    let text: string
    try {
      text = await file.text()
    } catch {
      return invalid(['The file could not be read.'])
    }
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      return invalid(['The file is not valid JSON. It may be damaged, cut short, or not a backup.'])
    }
    const v = validateBackup(raw)
    if (!v.ok) return invalid(v.errors)
    setPlan(defaultPlan(v.backup, existingIds))
    setStage({ kind: 'preview', fileName: file.name, sizeBytes: file.size, backup: v.backup, summary: v.summary })
  }

  async function run() {
    if (stage.kind !== 'preview' || !plan) return
    setBusy(true)
    setError(null)
    setConfirmOpen(false)
    try {
      const report = await restoreBackup(stage.backup, plan, (d, t) => setProgress(`Restoring profile ${d} of ${t}…`))
      try { sessionStorage.setItem('studyos.notice', `Restore complete: ${reportText(report)}.`) } catch { /* optional */ }
      setStage({ kind: 'done', report })
    } catch (e) {
      setError(`Restore failed: ${e instanceof Error ? e.message : 'unknown error'}. Your existing data was not changed.`)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function downloadCurrent() {
    setPreMsg(null)
    try {
      const r = await exportAndDownload({ kind: 'all' })
      setPreMsg(`Backup of current data downloaded: ${r.fileName}. Check that it saved before continuing.`)
    } catch (e) {
      setPreMsg(e instanceof Error ? e.message : 'Backup failed.')
    }
  }

  const problems = stage.kind === 'preview' && plan ? checkPlan(stage.backup, plan, existingIds) : []
  const replacing = stage.kind === 'preview' && plan
    ? Object.values(plan.actions).filter((a) => a.type === 'replace') : []
  const merging = plan ? Object.values(plan.actions).some((a) => a.type === 'merge') : false

  return (
    <section aria-labelledby="restore-h" className="space-y-3">
      <h2 id="restore-h" className="text-xl font-semibold">Restore from a backup file</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Choose a StudyOS backup file. It is checked first and nothing changes until you confirm.
      </p>
      <label className={`${secondaryBtn} cursor-pointer focus-within:outline-2 focus-within:outline-indigo-500`}>
        <input type="file" accept=".json,application/json" className="sr-only" onChange={onFile} disabled={busy} />
        Choose backup file
      </label>

      {stage.kind === 'invalid' && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">“{stage.fileName}” cannot be imported. Nothing was changed.</p>
          <ul className="mt-1 list-disc pl-5">{stage.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      {stage.kind === 'preview' && plan && (
        <div className="space-y-4">
          <p className="text-sm text-green-800 dark:text-green-300">“{stage.fileName}” passed validation. Review what will happen:</p>
          <BackupSummaryView summary={stage.summary} sizeBytes={stage.sizeBytes} />

          <ul className="space-y-3">
            {stage.backup.profiles.map((entry) => {
              const p = entry.profile
              const counts = stage.summary.profiles.find((s) => s.id === p.id)?.counts ?? {}
              return (
                <li key={p.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <Avatar avatar={p.avatar} name={p.displayName} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.displayName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{describeCounts(counts)}</p>
                    </div>
                  </div>
                  <label className="mt-2 block text-sm font-medium">
                    What to do with this profile
                    <select className={fieldCls} value={toValue(plan.actions[p.id] ?? { type: 'skip' })}
                      onChange={(e) => setPlan({ ...plan, actions: { ...plan.actions, [p.id]: fromValue(e.target.value) } })}>
                      <option value="create">Create as a new profile</option>
                      {profiles.map((t) => (
                        <option key={`m${t.id}`} value={`merge:${t.id}`}>Merge into “{t.displayName}”</option>
                      ))}
                      {profiles.map((t) => (
                        <option key={`r${t.id}`} value={`replace:${t.id}`}>Replace “{t.displayName}” (deletes its current data)</option>
                      ))}
                      <option value="skip">Do not import</option>
                    </select>
                  </label>
                </li>
              )
            })}
          </ul>

          {merging && (
            <label className="block text-sm font-medium">
              When the same record exists in both places and differs
              <select className={fieldCls} value={plan.policy}
                onChange={(e) => setPlan({ ...plan, policy: e.target.value as ConflictPolicy })}>
                <option value="keep-existing">Keep the existing version</option>
                <option value="use-backup">Use the backup version</option>
                <option value="newer">Keep whichever was edited most recently</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                Records are matched by their stable ID. Records missing here are added; identical ones
                are skipped. Profile details (name, avatar…) change only with “Use the backup version”.
              </span>
            </label>
          )}

          {problems.length > 0 && (
            <ul role="alert" className="list-disc pl-5 text-sm text-red-700 dark:text-red-300">
              {problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {progress && <p role="status" className="text-sm">{progress}</p>}
          {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button className={primaryBtn} disabled={busy || problems.length > 0}
              onClick={() => (replacing.length > 0 ? setConfirmOpen(true) : void run())}>
              {busy ? 'Restoring…' : 'Restore'}
            </button>
            <button className={secondaryBtn} disabled={busy} onClick={reset}>Cancel</button>
          </div>
        </div>
      )}

      {stage.kind === 'done' && (
        <div role="status" className="space-y-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <p className="font-medium">Restore complete.</p>
          <p>{reportText(stage.report)}.</p>
          <p>Next: open <a className="underline" href="#/profiles">Profiles</a>, switch to the restored profile and check that your records look right.</p>
          <button className={secondaryBtn} onClick={reset}>Done</button>
        </div>
      )}

      <ConfirmDialog open={confirmOpen} title="Replace existing profile data?" confirmLabel="Replace data"
        danger busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={run}>
        <p>This permanently deletes the current data of the profile(s) you chose to replace and puts the
          backup’s data in their place. The whole restore is all-or-nothing: if anything fails, nothing is changed.</p>
        <button type="button" className={secondaryBtn} onClick={downloadCurrent}>Download a backup of my current data first</button>
        {preMsg && <p role="status">{preMsg}</p>}
      </ConfirmDialog>
    </section>
  )
              }
