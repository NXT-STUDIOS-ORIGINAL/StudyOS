import { useState, type FormEvent } from 'react'
import type { ProfileDraft } from '../domain/types'
import { validateProfileDraft } from '../domain/profile'
import { useDirtyGuard } from '../hooks/useDirtyGuard'
import { AvatarPicker } from './AvatarPicker'
import { fieldCls, primaryBtn, secondaryBtn } from './ui'

interface Props {
  initial: ProfileDraft
  submitLabel: string
  onSave: (d: ProfileDraft) => Promise<void>
  onCancel?: () => void
}

export function ProfileForm({ initial, submitLabel, onSave, onCancel }: Props) {
  const [d, setD] = useState<ProfileDraft>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  useDirtyGuard(JSON.stringify(d) !== JSON.stringify(initial))

  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((p) => ({ ...p, [k]: v }))
  const text = (k: 'displayName' | 'nickname' | 'board' | 'classGrade' | 'academicYear' | 'schoolName') => ({
    className: fieldCls,
    value: d[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: ProfileDraft = {
      ...d,
      displayName: d.displayName.trim(), nickname: d.nickname.trim(), board: d.board.trim(),
      classGrade: d.classGrade.trim(), academicYear: d.academicYear.trim(), schoolName: d.schoolName.trim(),
    }
    const errs = validateProfileDraft(next)
    setErrors(errs)
    if (errs.length > 0) return
    setBusy(true)
    try {
      await onSave(next)
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Could not save the profile.'])
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <AvatarPicker value={d.avatar} name={d.displayName} onChange={(a) => set('avatar', a)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Display name (required)
          <input {...text('displayName')} autoComplete="off" /></label>
        <label className="block text-sm font-medium">Nickname (optional)
          <input {...text('nickname')} autoComplete="off" /></label>
        <label className="block text-sm font-medium">Academic board
          <input {...text('board')} /></label>
        <label className="block text-sm font-medium">Class or grade
          <input {...text('classGrade')} /></label>
        <label className="block text-sm font-medium">Academic year
          <input {...text('academicYear')} placeholder="e.g. 2026-27" /></label>
        <label className="block text-sm font-medium">School name (optional)
          <input {...text('schoolName')} /></label>
      </div>
      {errors.length > 0 && (
        <ul role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className={secondaryBtn}>Cancel</button>}
      </div>
    </form>
  )
    }
