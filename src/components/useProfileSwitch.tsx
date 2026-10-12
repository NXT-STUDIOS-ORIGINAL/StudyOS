import { useState, type ReactNode } from 'react'
import { setActiveProfile } from '../lib/db'
import { hasUnsavedChanges } from '../lib/dirty'
import { ConfirmDialog } from './ConfirmDialog'

export function useProfileSwitch(): { request: (id: string) => void; dialog: ReactNode; error: string | null } {
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(id: string) {
    try {
      await setActiveProfile(id)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch profile.')
    }
  }

  const request = (id: string) => {
    if (hasUnsavedChanges()) setPending(id)
    else void run(id)
  }

  const dialog = (
    <ConfirmDialog open={pending !== null} title="Discard unsaved changes?" confirmLabel="Discard and switch"
      danger onCancel={() => setPending(null)}
      onConfirm={async () => { if (pending) await run(pending); setPending(null) }}>
      <p>You have edits that are not saved. Switching profiles will discard them.</p>
    </ConfirmDialog>
  )

  return { request, dialog, error }
}
