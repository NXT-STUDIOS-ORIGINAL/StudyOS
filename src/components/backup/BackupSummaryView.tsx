import { format } from 'date-fns'
import { describeCounts, formatBytes, type BackupSummary } from '../../domain/backup/format'

export function BackupSummaryView({ summary, sizeBytes }: { summary: BackupSummary; sizeBytes?: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1">
        <dt className="text-slate-500 dark:text-slate-400">Scope</dt>
        <dd>{summary.scope === 'all' ? 'All profiles' : 'Single profile'}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Exported</dt>
        <dd>{format(Date.parse(summary.exportedAt), 'd MMM yyyy, HH:mm')}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Format</dt>
        <dd>Version {summary.schemaVersion} (app {summary.appVersion})</dd>
        {sizeBytes !== undefined && (<>
          <dt className="text-slate-500 dark:text-slate-400">Size</dt>
          <dd>{formatBytes(sizeBytes)}</dd>
        </>)}
      </dl>
      <ul className="mt-3 space-y-1">
        {summary.profiles.map((p) => (
          <li key={p.id}><strong>{p.displayName}</strong>: {describeCounts(p.counts)}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Counts for subjects, study sessions, exams and notes will appear here once those features exist.
      </p>
    </div>
  )
}
