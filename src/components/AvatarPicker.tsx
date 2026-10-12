import { useState, type ChangeEvent } from 'react'
import type { Avatar as AvatarData } from '../domain/types'
import { DEFAULT_AVATARS } from '../domain/profile'
import { fileToAvatarDataUrl } from '../lib/avatar'
import { Avatar } from './Avatar'
import { secondaryBtn } from './ui'

interface Props { value: AvatarData; name: string; onChange: (a: AvatarData) => void }

export function AvatarPicker({ value, name, onChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange({ kind: 'image', dataUrl: await fileToAvatarDataUrl(file) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">Avatar</legend>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Avatar avatar={value} name={name || '?'} size={64} />
        <div className="flex flex-wrap gap-2">
          {DEFAULT_AVATARS.map((a) => {
            const selected = value.kind === 'default' && value.key === a.key
            return (
              <button key={a.key} type="button" aria-label={`Use ${a.label} avatar`} aria-pressed={selected}
                onClick={() => onChange({ kind: 'default', key: a.key })}
                className={`h-11 w-11 rounded-full ${selected ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-950' : ''}`}
                style={{ backgroundColor: a.color }} />
            )
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className={`${secondaryBtn} cursor-pointer focus-within:outline-2 focus-within:outline-indigo-500`}>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
            onChange={onFile} disabled={busy} />
          {busy ? 'Processing…' : 'Choose photo'}
        </label>
        {value.kind === 'image' && (
          <button type="button" className={secondaryBtn}
            onClick={() => onChange({ kind: 'default', key: 'indigo' })}>
            Remove photo
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Photos are resized to 256 px and stay on this device only.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
    </fieldset>
  )
}
