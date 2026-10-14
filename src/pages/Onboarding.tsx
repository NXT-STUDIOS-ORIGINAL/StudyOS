import { ProfileForm } from '../components/ProfileForm'
import { RestoreSection } from '../components/backup/RestoreSection'
import { createProfile } from '../lib/db'
import { emptyProfileDraft } from '../domain/profile'

export function Onboarding() {
  return (
    <div className="mx-auto max-w-xl space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to StudyOS</h1>
        <p className="mb-6 mt-2 text-sm text-slate-600 dark:text-slate-400">
          Create your first profile. It lives only in this browser on this device: no account, email or
          password, and nothing is sent anywhere. Clearing browser data can erase it, so download backups
          regularly from Backup &amp; Restore.
        </p>
        <ProfileForm initial={emptyProfileDraft()} submitLabel="Start using StudyOS"
          onSave={async (d) => { await createProfile(d) }} />
      </div>
      <details className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          Already have a backup file? Restore it instead
        </summary>
        <div className="mt-4"><RestoreSection /></div>
      </details>
    </div>
  )
}
