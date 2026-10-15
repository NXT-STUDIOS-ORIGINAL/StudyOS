import { useState, type FormEvent } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  ACTIVITY_ROLES, ROLE_LABELS, type ActivityRole, type ActivityType, type ActivityTypeDraft,
} from '../../domain/activity/types'
import {
  copyActivityTypes, createActivityType, deleteActivityType, moveActivityType, updateActivityType,
} from '../../lib/activityRepo'
import { useSubmit } from '../../hooks/useSubmit'
import { ConfirmDialog } from '../ConfirmDialog'
import { fieldCls, primaryBtn, secondaryBtn } from '../ui'

interface Props {
  profileId: string
  scope: string | null // subject id, or null = default set for new subjects
  types: ActivityType[] // this list's activities, ordered
  recordCounts: Map<string, number> // activity id -> number of recorded entries
  copySources: { id: string | null; label: string }[]
  onClose: () => void
}

function TypeForm({ initial, submitLabel, onSave, onCancel }: {
  initial: ActivityTypeDraft; submitLabel: string
  onSave: (d: ActivityTypeDraft) => Promise<void>; onCancel: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [weight, setWeight] = useState(initial.weight === null ? '' : String(initial.weight))
  const [role, setRole] = useState<ActivityRole>(initial.role)
  const [enabled, setEnabled] = useState(initial.enabled)
  const { busy, error, run } = useSubmit()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void run(() => onSave({ name: name.trim(), weight: weight.trim() === '' ? null : Number(weight), role, enabled }))
  }
  return (
    <form noValidate className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">Activity name
        <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block text-sm font-medium">What kind of work is it?
        <select className={fieldCls} value={role} onChange={(e) => setRole(e.target.value as ActivityRole)}>
          {ACTIVITY_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          Used by exam readiness later, so it keeps working however you name things.
        </span>
      </label>
      <label className="block text-sm font-medium">Weight (optional)
        <input className={fieldCls} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          Only used in the weighted view. Empty counts as 1.
        </span>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" className="h-5 w-5" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enabled (shown on chapters)
      </label>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className={primaryBtn} disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  )
}

export function ActivityTypesEditor({ profileId, scope, types, recordCounts, copySources, onClose }: Props) {
  const [mode, setMode] = useState<{ edit: ActivityType | null } | null>(null)
  const [toDelete, setToDelete] = useState<ActivityType | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyFrom, setCopyFrom] = useState<string>(copySources[0] ? String(copySources[0].id) : '')
  const [msg, setMsg] = useState<string | null>(null)

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    setMsg(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'That did not work.') }
  }

  if (mode) {
    const edit = mode.edit
    return (
      <TypeForm
        initial={edit ? { name: edit.name, enabled: edit.enabled, weight: edit.weight, role: edit.role }
          : { name: '', enabled: true, weight: null, role: 'practice' }}
        submitLabel={edit ? 'Save' : 'Add activity'}
        onCancel={() => setMode(null)}
        onSave={async (d) => {
          if (edit) await updateActivityType(profileId, edit.id, d)
          else await createActivityType(profileId, scope, d)
          setMode(null)
        }}
      />
    )
  }

  const toggle = (t: ActivityType) =>
    act(() => updateActivityType(profileId, t.id, { name: t.name, enabled: !t.enabled, weight: t.weight, role: t.role }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {scope === null
          ? 'This default set is copied into each new subject. Changing it does not alter existing subjects.'
          : 'These activities appear on every chapter of this subject. Nothing is required: remove or disable any you do not use.'}
      </p>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {types.length === 0 && <p className="text-sm">No activities yet. Add one below.</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {types.map((t, i) => (
          <li key={t.id} className="flex flex-wrap items-center gap-1 py-1">
            <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={t.enabled}
                aria-label={`${t.name} enabled`} onChange={() => void toggle(t)} />
              <span className={t.enabled ? '' : 'text-slate-400 line-through'}>
                {t.name}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                  {ROLE_LABELS[t.role]}{t.weight !== null && ` · weight ${t.weight}`}
                </span>
              </span>
            </label>
            <button type="button" aria-label={`Move ${t.name} earlier`} disabled={i === 0}
              onClick={() => void act(() => moveActivityType(profileId, t.id, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><ArrowUp size={18} aria-hidden /></button>
            <button type="button" aria-label={`Move ${t.name} later`} disabled={i === types.length - 1}
              onClick={() => void act(() => moveActivityType(profileId, t.id, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><ArrowDown size={18} aria-hidden /></button>
            <button type="button" aria-label={`Edit ${t.name}`} onClick={() => setMode({ edit: t })}
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil size={18} aria-hidden /></button>
            <button type="button" aria-label={`Delete ${t.name}`} onClick={() => setToDelete(t)}
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><Trash2 size={18} aria-hidden /></button>
          </li>
        ))}
      </ul>
      <button type="button" className={`${primaryBtn} inline-flex items-center gap-1`} onClick={() => setMode({ edit: null })}>
        <Plus size={16} aria-hidden /> Add activity
      </button>

      {copySources.length > 0 && (
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="block text-sm font-medium">Copy activities from
            <select className={fieldCls} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              {copySources.map((s) => <option key={String(s.id)} value={String(s.id)}>{s.label}</option>)}
            </select>
          </label>
          <button type="button" className={secondaryBtn}
            onClick={() => void act(async () => {
              const from = copySources.find((s) => String(s.id) === copyFrom)
              if (!from) return
              const n = await copyActivityTypes(profileId, from.id, scope)
              setMsg(n === 0 ? 'Nothing to add: every activity there already exists here.' : `Added ${n} activity(ies).`)
            })}>
            Add the ones missing here
          </button>
          {msg && <p role="status" className="text-sm">{msg}</p>}
        </div>
      )}

      <div className="flex justify-end"><button type="button" className={primaryBtn} onClick={onClose}>Done</button></div>

      <ConfirmDialog open={toDelete !== null} title={`Delete “${toDelete?.name ?? ''}”?`}
        confirmLabel="Delete permanently" danger busy={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return
          setBusy(true)
          await act(() => deleteActivityType(profileId, toDelete.id))
          setBusy(false)
          setToDelete(null)
        }}>
        <p>This removes the activity from {scope === null ? 'the default set' : 'this subject'}
          {(recordCounts.get(toDelete?.id ?? '') ?? 0) > 0
            ? ` and permanently deletes its ${recordCounts.get(toDelete?.id ?? '')} recorded entr${recordCounts.get(toDelete?.id ?? '') === 1 ? 'y' : 'ies'} (ticks, dates, history).`
            : '.'}
        </p>
        <p>To hide it but keep its history, untick “Enabled” instead.</p>
      </ConfirmDialog>
    </div>
  )
      }
