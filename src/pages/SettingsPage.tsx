import { SettingsForm } from '../components/SettingsForm'
import { saveSettings } from '../lib/db'
import type { Settings } from '../domain/types'

export function SettingsPage({ settings }: { settings: Settings }) {
  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <SettingsForm initial={settings} submitLabel="Save settings" onSave={saveSettings} />
    </div>
  )
}
