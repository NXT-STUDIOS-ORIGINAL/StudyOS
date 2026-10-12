import { SettingsForm } from '../components/SettingsForm'
import { saveSettings } from '../lib/db'
import type { Settings } from '../domain/types'

export function Onboarding({ initial }: { initial: Settings }) {
  return (
    <div className="mx-auto max-w-xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold">Welcome to StudyOS</h1>
      <p className="mb-6 mt-2 text-sm text-slate-600 dark:text-slate-400">
        Everything is stored only in this browser on this device. There is no account and no
        sync. Clearing browser data can erase it, so back up regularly (backup arrives in a
        later phase). Every field below can be changed later.
      </p>
      <SettingsForm
        initial={initial}
        submitLabel="Start using StudyOS"
        onSave={(s) => saveSettings({ ...s, onboarded: true })}
      />
    </div>
  )
}
