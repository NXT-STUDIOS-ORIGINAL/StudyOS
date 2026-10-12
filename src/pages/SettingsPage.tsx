import { Link } from 'react-router-dom'
import { SettingsForm } from '../components/SettingsForm'
import { saveProfileSettings } from '../lib/db'
import { toSettingsDraft } from '../domain/settings'
import type { Profile, ProfileSettings } from '../domain/types'

export function SettingsPage({ profile, settings }: { profile: Profile; settings: ProfileSettings }) {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mb-6 mt-2 text-sm text-slate-600 dark:text-slate-400">
        These settings belong to <strong>{profile.displayName}</strong>. To change name, avatar or
        academic details, or to switch profile, go to <Link to="/profiles" className="underline">Profiles</Link>.
      </p>
      <SettingsForm initial={toSettingsDraft(settings)} onSave={(d) => saveProfileSettings(profile.id, d)} />
    </div>
  )
}
