import { useState } from 'react'
import type { Profile } from '../../domain/types'
import { exportAndDownload, type ExportResult, type ExportScope } from '../../lib/backup'
import { primaryBtn, secondaryBtn } from '../ui'
import { BackupSummaryView } from './BackupSummaryView'

export function ExportSection({ profiles, active }: { profiles: Profile[]; active: Profile }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(scope: ExportScope) {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await exportAndDownload(scope))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="export-h" className="space-y-3">
      <h2 id="export-h" className="text-xl font-semibold">Create a backup</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A backup is a JSON file saved to your device. It contains profile details, avatar and all study
        data for the profiles you choose. Keep it private.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={primaryBtn} disabled={busy} onClick={() => run({ kind: 'profile', id: active.id })}>
          Export “{active.displayName}”
        </button>
        {profiles.length > 1 && (
          <button className={secondaryBtn} disabled={busy} onClick={() => run({ kind: 'all' })}>
            Export all {profiles.length} profiles
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {result && (
        <div role="status" className="space-y-2">
          <p className="text-sm text-green-800 dark:text-green-300">
            Backup file created: <strong>{result.fileName}</strong>. Your browser should have saved it to
            its download location (often Downloads). StudyOS cannot see where your device put it, so
            check that the file is really there.
          </p>
          <BackupSummaryView summary={result.summary} sizeBytes={result.sizeBytes} />
        </div>
      )}
    </section>
  )
}
