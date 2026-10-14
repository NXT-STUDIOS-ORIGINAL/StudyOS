import { Link } from 'react-router-dom'
import { useBackupStatus } from '../hooks/useBackupStatus'
import { isBackupDue, DAY_MS } from '../domain/backup/reminder'
import { snoozeReminder } from '../lib/backupState'
import { secondaryBtn } from './ui'

export function BackupReminder() {
  const s = useBackupStatus()
  if (!s) return null
  const now = Date.now()
  if (!isBackupDue({ now, ...s })) return null
  const since = s.lastBackupAt ?? s.oldestProfileCreatedAt ?? now
  const days = Math.floor((now - since) / DAY_MS)
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <span className="flex-1">
        {s.lastBackupAt ? `Your last backup was ${days} day(s) ago.` : 'You have not downloaded a backup yet.'}
      </span>
      <Link to="/backup" className={secondaryBtn}>Back up now</Link>
      <button className={secondaryBtn} onClick={() => void snoozeReminder()}>Remind me tomorrow</button>
    </div>
  )
}
