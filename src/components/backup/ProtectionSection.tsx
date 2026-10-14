import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { useBackupStatus } from '../../hooks/useBackupStatus'
import { setReminderDays } from '../../lib/backupState'
import { getStorageInfo, requestPersistence, type StorageInfo } from '../../lib/storage'
import { formatBytes } from '../../domain/backup/format'
import { fieldCls, secondaryBtn } from '../ui'

export function ProtectionSection() {
  const status = useBackupStatus()
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { void getStorageInfo().then(setInfo) }, [])

  async function ask() {
    const granted = await requestPersistence()
    setMsg(
      granted === true ? 'The browser granted persistent storage. This lowers the risk of automatic clean-up but does not make data permanent.'
      : granted === false ? 'The browser declined. Your data still works normally, but keep regular backups.'
      : 'This browser does not support the request. Keep regular backups.',
    )
    setInfo(await getStorageInfo())
  }

  return (
    <section aria-labelledby="protect-h" className="space-y-3">
      <h2 id="protect-h" className="text-xl font-semibold">Backup protection</h2>
      <p className="text-sm">
        Last backup downloaded from this browser:{' '}
        <strong>{status?.lastBackupAt ? format(status.lastBackupAt, 'd MMM yyyy, HH:mm') : 'never'}</strong>
      </p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Your data lives in this browser’s storage. Clearing site data or browsing data, uninstalling the
        browser, or the browser freeing space can erase it. A backup file stored elsewhere is the only
        real protection.
      </p>
      <label className="block max-w-xs text-sm font-medium">Remind me to back up
        <select className={fieldCls} value={status?.reminderDays ?? 14}
          onChange={(e) => void setReminderDays(Number(e.target.value))}>
          <option value={0}>Never</option>
          <option value={7}>After 7 days</option>
          <option value={14}>After 14 days</option>
          <option value={30}>After 30 days</option>
        </select>
      </label>
      <div className="space-y-2 text-sm">
        <p>
          Storage: {info?.supported
            ? `${info.persisted === null ? 'persistence unknown' : info.persisted ? 'marked persistent' : 'not marked persistent'}${info.usageBytes !== null ? `, using about ${formatBytes(info.usageBytes)}` : ''}`
            : 'status not available in this browser'}
        </p>
        <button className={secondaryBtn} onClick={ask}>Request persistent storage</button>
        {msg && <p role="status">{msg}</p>}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        StudyOS does not keep automatic backup copies inside the browser: they would sit in the same
        storage that a wipe erases, and could grow without limit. Download files instead.
      </p>
    </section>
  )
}
