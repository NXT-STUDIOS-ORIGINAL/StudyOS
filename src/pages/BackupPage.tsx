import type { Profile } from '../domain/types'
import { ExportSection } from '../components/backup/ExportSection'
import { RestoreSection } from '../components/backup/RestoreSection'
import { ProtectionSection } from '../components/backup/ProtectionSection'

export function BackupPage({ profiles, active }: { profiles: Profile[]; active: Profile }) {
  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-2xl font-semibold">Backup &amp; Restore</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Everything stays on this device. Nothing is uploaded, and StudyOS has no cloud sync. Backups are
          ordinary files you move yourself.
        </p>
      </header>
      <ExportSection profiles={profiles} active={active} />
      <RestoreSection />
      <section aria-labelledby="transfer-h" className="space-y-3">
        <h2 id="transfer-h" className="text-xl font-semibold">Transfer to another device</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>On the old device, open Backup &amp; Restore and create a backup (one profile or all).</li>
          <li>Move the downloaded file to the new device by any method: USB, Bluetooth, email, a cloud drive, a messaging app.</li>
          <li>On the new device, open StudyOS (same web address).</li>
          <li>Choose “Restore from a backup file” and select the file. It is validated and previewed first.</li>
          <li>Pick the destination: create a new profile, merge into one, or replace one.</li>
          <li>Open Profiles, switch to the restored profile and verify your records.</li>
        </ol>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          StudyOS cannot tell whether a file has arrived on another device. Only step 6 confirms it worked.
        </p>
      </section>
      <ProtectionSection />
    </div>
  )
}
