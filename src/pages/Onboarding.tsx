import { ProfileForm } from '../components/ProfileForm'
import { createProfile } from '../lib/db'
import { emptyProfileDraft } from '../domain/profile'

export function Onboarding() {
  return (
    <div className="mx-auto max-w-xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Welcome to StudyOS</h1>
      <p className="mb-6 mt-2 text-sm text-slate-600 dark:text-slate-400">
        Create your first profile. It lives only in this browser on this device: no account, email or
        password, and nothing is sent anywhere. Clearing browser data can erase it, so back up
        regularly (backup arrives in the next step). You can add more profiles later and change
        study goals, timers and revision settings in Settings.
      </p>
      <ProfileForm initial={emptyProfileDraft()} submitLabel="Start using StudyOS"
        onSave={async (d) => { await createProfile(d) }} />
    </div>
  )
}
