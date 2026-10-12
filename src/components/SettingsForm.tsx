import { useState, type FormEvent } from 'react'
import type { SettingsDraft, ThemeChoice } from '../domain/types'
import { parseIntervals, validateSettings } from '../domain/settings'
import { useDirtyGuard } from '../hooks/useDirtyGuard'
import { fieldCls, primaryBtn } from './ui'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  initial: SettingsDraft
  onSave: (s: SettingsDraft) => Promise<void>
}

export function SettingsForm({ initial, onSave }: Props) {
  const [s, setS] = useState<SettingsDraft>(initial)
  const [intervals, setIntervals] = useState(initial.revisionIntervals.join(', '))
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  useDirtyGuard(
    JSON.stringify(s) !== JSON.stringify(initial) || intervals !== initial.revisionIntervals.join(', '),
  )

  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setS((prev) => ({ ...prev, [key]: value }))
    setStatus('idle')
  }
  const toggleDay = (d: number) =>
    set('preferredDays', s.preferredDays.includes(d)
      ? s.preferredDays.filter((x) => x !== d)
      : [...s.preferredDays, d].sort())
  const num = (v: string) => (v === '' ? NaN : Number(v))
  const show = (n: number) => (Number.isFinite(n) ? n : '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: SettingsDraft = { ...s, revisionIntervals: parseIntervals(intervals) ?? [] }
    const errs = validateSettings(next)
    setErrors(errs)
    if (errs.length > 0) return
    setStatus('saving')
    try {
      await onSave(next)
      setS(next)
      setIntervals(next.revisionIntervals.join(', '))
      setStatus('saved')
    } catch (err) {
      setStatus('idle')
      setErrors([err instanceof Error ? err.message : 'Could not save settings.'])
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Daily study goal (hours)
          <input className={fieldCls} type="number" inputMode="decimal" step="0.25" min="0.25" max="24"
            value={Number.isFinite(s.dailyTargetMinutes) ? s.dailyTargetMinutes / 60 : ''}
            onChange={(e) => set('dailyTargetMinutes', Math.round(num(e.target.value) * 60))} />
        </label>
        <label className="block text-sm font-medium">Weekly study goal (hours)
          <input className={fieldCls} type="number" inputMode="decimal" step="0.25" min="0.25" max="168"
            value={Number.isFinite(s.weeklyTargetMinutes) ? s.weeklyTargetMinutes / 60 : ''}
            onChange={(e) => set('weeklyTargetMinutes', Math.round(num(e.target.value) * 60))} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Preferred study days</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d}
              className={`flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm focus-within:outline-2 focus-within:outline-indigo-500 ${
                s.preferredDays.includes(i) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-700'
              }`}>
              <input type="checkbox" className="sr-only" checked={s.preferredDays.includes(i)} onChange={() => toggleDay(i)} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Week starts on
          <select className={fieldCls} value={s.weekStart} onChange={(e) => set('weekStart', Number(e.target.value))}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">Theme
          <select className={fieldCls} value={s.theme} onChange={(e) => set('theme', e.target.value as ThemeChoice)}>
            <option value="system">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">Focus (min)
          <input className={fieldCls} type="number" inputMode="numeric" value={show(s.focusMinutes)}
            onChange={(e) => set('focusMinutes', num(e.target.value))} /></label>
        <label className="block text-sm font-medium">Short break (min)
          <input className={fieldCls} type="number" inputMode="numeric" value={show(s.shortBreakMinutes)}
            onChange={(e) => set('shortBreakMinutes', num(e.target.value))} /></label>
        <label className="block text-sm font-medium">Long break (min)
          <input className={fieldCls} type="number" inputMode="numeric" value={show(s.longBreakMinutes)}
            onChange={(e) => set('longBreakMinutes', num(e.target.value))} /></label>
      </div>

      <label className="block text-sm font-medium">Revision intervals (days, comma separated)
        <input className={fieldCls} value={intervals} aria-describedby="interval-help"
          onChange={(e) => { setIntervals(e.target.value); setStatus('idle') }} />
        <span id="interval-help" className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          1, 3, 7, 14, 30 is a common starting point, not a proven optimum. Adjust to suit you.
        </span>
      </label>

      <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
        <input type="checkbox" className="h-5 w-5" checked={s.gamification}
          onChange={(e) => set('gamification', e.target.checked)} />
        Enable optional XP and achievements
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {status === 'saved' && <p role="status" className="text-sm text-green-700 dark:text-green-400">Saved.</p>}

      <button type="submit" disabled={status === 'saving'} className={primaryBtn}>
        {status === 'saving' ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  )
    }
