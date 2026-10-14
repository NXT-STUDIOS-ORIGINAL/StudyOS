import { useState } from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import type { Profile } from '../domain/types'
import { toProfileDraft, emptyProfileDraft } from '../domain/profile'
import { createProfile, deleteProfile, updateProfile } from '../lib/db'
import { exportAndDownload } from '../lib/backup'
import { Avatar } from '../components/Avatar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ProfileForm } from '../components/ProfileForm'
import { useProfileSwitch } from '../components/useProfileSwitch'
import { primaryBtn, secondaryBtn } from '../components/ui'

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; id: string }

export function ProfilesPage({ profiles, active }: { profiles: Profile[]; active: Profile }) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [toDelete, setToDelete] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { request, dialog, error } = useProfileSwitch()
  const [exportMsg, setExportMsg] = useState<{ id: string; text: string } | null>(null)

  async function backupFirst() {
    if (!toDelete) return
    const id = toDelete.id
    try {
      const r = await exportAndDownload({ kind: 'profile', id })
      setExportMsg({ id, text: `Backup downloaded: ${r.fileName}. Check that it saved before deleting.` })
    } catch (e) {
      setExportMsg({ id, text: e instanceof Error ? e.message : 'Backup failed.' })
    }
  }

  if (mode.kind === 'create') {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold">New profile</h1>
        <ProfileForm initial={emptyProfileDraft()} submitLabel="Create and switch"
          onSave={async (d) => { await createProfile(d); setMode({ kind: 'list' }) }}
          onCancel={() => setMode({ kind: 'list' })} />
      </div>
    )
  }

  if (mode.kind === 'edit') {
    const p = profiles.find((x) => x.id === mode.id)
    if (!p) return <p>That profile no longer exists.</p>
    return (
      <div className="max-w-2xl">
        <h1 className="mb-6 text-2xl font-semibold">Edit profile</h1>
        <ProfileForm initial={toProfileDraft(p)} submitLabel="Save profile"
          onSave={async (d) => { await updateProfile(p.id, d); setMode({ kind: 'list' }) }}
          onCancel={() => setMode({ kind: 'list' })} />
      </div>
    )
  }

  async function confirmDelete() {
    if (!toDelete) return
    setBusy(true)
    setDeleteError(null)
    try {
      await deleteProfile(toDelete.id)
      setToDelete(null)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete the profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        <button className={`${primaryBtn} inline-flex items-center gap-2`} onClick={() => setMode({ kind: 'create' })}>
          <Plus size={18} aria-hidden /> New profile
        </button>
      </div>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
        Profiles are stored only in this browser on this device. They are not online accounts, need no
        password, and are not synced anywhere. Each profile keeps its own data separate from the others.
      </p>
      {error && <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <ul className="grid gap-4 sm:grid-cols-2">
        {profiles.map((p) => {
          const isActive = p.id === active.id
          const details = [p.board, p.classGrade, p.academicYear, p.schoolName].filter(Boolean).join(' · ')
          return (
            <li key={p.id} className={`rounded-xl border bg-white p-4 dark:bg-slate-900 ${isActive ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <Avatar avatar={p.avatar} name={p.displayName} size={48} />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{p.displayName}</h2>
                  {p.nickname && <p className="truncate text-sm text-slate-600 dark:text-slate-400">“{p.nickname}”</p>}
                </div>
                {isActive && <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">Active</span>}
              </div>
              {details && <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{details}</p>}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Created {format(p.createdAt, 'd MMM yyyy')} · {isActive ? 'Active now' : `Last active ${format(p.lastActiveAt, 'd MMM yyyy')}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {!isActive && <button className={secondaryBtn} onClick={() => request(p.id)}>Switch to</button>}
                <button className={secondaryBtn} onClick={() => setMode({ kind: 'edit', id: p.id })}>Edit</button>
                <button className={`${secondaryBtn} text-red-700 dark:text-red-300`}
                  onClick={() => { setDeleteError(null); setToDelete(p) }}>Delete</button>
              </div>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog open={toDelete !== null} title={`Delete “${toDelete?.displayName ?? ''}”?`}
        confirmLabel="Delete permanently" danger busy={busy} error={deleteError}
        onCancel={() => setToDelete(null)} onConfirm={confirmDelete}>
        <p>This permanently deletes this profile and everything stored under it on this device: its
          settings and, as those features are added, its subjects, syllabus, tasks, study sessions,
          exams, tests, revisions, notes and mistakes.</p>
        <p>Other profiles are not affected. This cannot be undone.</p>
        {profiles.length === 1 && <p>This is your only profile, so you will return to the welcome screen.</p>}
        <button type="button" className={secondaryBtn} onClick={backupFirst}>Download a backup of this profile first</button>
        {exportMsg && exportMsg.id === toDelete?.id && <p role="status">{exportMsg.text}</p>}
      </ConfirmDialog>
      {dialog}
    </div>
  )
}
