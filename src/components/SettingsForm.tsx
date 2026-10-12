import { useState, type FormEvent } from 'react'
import type { Settings, ThemeChoice } from '../domain/types'
import { parseIntervals, validateSettings } from '../domain/settings'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const field =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base dark:border-slate-700 dark:bg-slate-900'

interface Props {
  initial: Settings
  submitLabel: string
  onSave: (s: Settings) => Promise<void>
}

export function SettingsForm({ initial, submitLabel, onSave }: Props) {
  const [s, setS] = useState<Settings>(initial)
  const [intervals, setIntervals] = useState(initial.revisionIntervals.join(', '))
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }))
    setStatus('idle')
  }

  const toggleDay = (d: number) =>
    set(
      'preferredDays',
      s.preferredDays.includes(d)
        ? s.preferredDays.filter((x) => x !== d)
        : [...s.preferredDays, d].sort(),
    )

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: Settings = { ...s, revisionIntervals: parseIntervals(intervals) ?? [] }
    const errs = validateSettings(next)
    setErrors(errs)
    if (errs.length > 0) return
    setStatus('saving')
    try {
      await onSave(next)
      setStatus('saved')
    } catch (err) {
      setStatus('idle')
      setErrors([err instanceof Error ? err.message : 'Could not save settings.'])
    }
  }

  const num = (v: string) => (v === '' ? NaN : Number(v))

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <label className="block text-sm font-medium">
        Name or nickname (optional)
        <input className={field} value={s.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Academic year
          <input className={field} placeholder="e.g. 2026-27" value={s.academicYear}
            onChange={(e) => set('academicYear', e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Board / class / course
          <input className={field} value={s.boardClass}
            onChange={(e) => set('boardClass', e.target.value)} />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Daily study target (hours)
        <input className={field} type="number" inputMode="decimal" step="0.25" min="0.25" max="24"
          value={Number.isFinite(s.dailyTargetMinutes) ? s.dailyTargetMinutes / 60 : ''}
          onChange={(e) => set('dailyTargetMinutes', Math.round(num(e.target.value) * 60))} />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Preferred study days</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d}
              className={`flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm ${
                s.preferredDays.includes(i)
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 dark:border-slate-700'
              }`}>
              <input type="checkbox" className="sr-only" checked={s.preferredDays.includes(i)}
                onChange={() => toggleDay(i)} />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Week starts on
          <select className={field} value={s.weekStart}
            onChange={(e) => set('weekStart', Number(e.target.value))}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Theme
          <select className={field} value={s.theme}
            onChange={(e) => set('theme', e.target.value as ThemeChoice)}>
            <option value="system">Match device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">
          Focus (min)
          <input className={field} type="number" inputMode="numeric" value={Number.isFinite(s.focusMinutes) ? s.focusMinutes : ''}
            onChange={(e) => set('focusMinutes', num(e.target.value))} />
        </label>
        <label className="block text-sm font-medium">
          Short break (min)
          <input className={field} type="number" inputMode="numeric" value={Number.isFinite(s.shortBreakMinutes) ? s.shortBreakMinutes : ''}
            onChange={(e) => set('shortBreakMinutes', num(e.target.value))} />
        </label>
        <label className="block text-sm font-medium">
          Long break (min)
          <input className={field} type="number" inputMode="numeric" value={Number.isFinite(s.longBreakMinutes) ? s.longBreakMinutes : ''}
            onChange={(e) => set('longBreakMinutes', num(e.target.value))} />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Revision intervals (days, comma separated)
        <input className={field} value={intervals} onChange={(e) => { setIntervals(e.target.value); setStatus('idle') }}
          aria-describedby="interval-help" />
        <span id="interval-help" className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
          A common starting point is 1, 3, 7, 14, 30. It is a default, not a proven optimum. Adjust to suit you.
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
      {status === 'saved' && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">Saved.</p>
      )}

      <button type="submit" disabled={status === 'saving'}
        className="min-h-11 rounded-lg bg-indigo-600 px-5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
        {status === 'saving' ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
    }
