import { useState, type FormEvent, type ReactNode } from 'react'
import {
  SUBJECT_COLORS, STATUS_LABELS, TOPIC_STATUSES,
  type ChapterDraft, type SubjectDraft, type TopicDraft, type TopicStatus,
} from '../../domain/syllabus/types'
import { useSubmit } from '../../hooks/useSubmit'
import { fieldCls, primaryBtn, secondaryBtn } from '../ui'

const optNumber = (s: string): number | null => (s.trim() === '' ? null : Number(s))

function Footer({ busy, error, submitLabel, onCancel }: { busy: boolean; error: string | null; submitLabel: string; onCancel: () => void }) {
  return (
    <>
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className={primaryBtn} disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </>
  )
}

function Form({ onSubmit, children }: { onSubmit: () => void; children: ReactNode }) {
  return (
    <form noValidate className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); onSubmit() }}>
      {children}
    </form>
  )
}

interface FormProps<T> { initial: T; submitLabel: string; onSave: (d: T) => Promise<void>; onCancel: () => void }

export function SubjectForm({ initial, submitLabel, onSave, onCancel }: FormProps<SubjectDraft>) {
  const [d, setD] = useState(initial)
  const { busy, error, run } = useSubmit()
  return (
    <Form onSubmit={() => void run(() => onSave({ ...d, name: d.name.trim() }))}>
      <label className="block text-sm font-medium">Subject name
        <input className={fieldCls} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Colour</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={d.color === c}
              onClick={() => setD({ ...d, color: c })} style={{ backgroundColor: c }}
              className={`h-11 w-11 rounded-full ${d.color === c ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : ''}`} />
          ))}
        </div>
      </fieldset>
      <Footer busy={busy} error={error} submitLabel={submitLabel} onCancel={onCancel} />
    </Form>
  )
}

export function ChapterForm({ initial, submitLabel, onSave, onCancel }: FormProps<ChapterDraft>) {
  const [name, setName] = useState(initial.name)
  const [weight, setWeight] = useState(initial.weight === null ? '' : String(initial.weight))
  const [hours, setHours] = useState(initial.estimatedMinutes === null ? '' : String(initial.estimatedMinutes / 60))
  const [target, setTarget] = useState(initial.targetDate ?? '')
  const [notes, setNotes] = useState(initial.notes)
  const { busy, error, run } = useSubmit()

  const submit = () => {
    const h = optNumber(hours)
    void run(() => onSave({
      name: name.trim(),
      weight: optNumber(weight),
      estimatedMinutes: h === null ? null : Math.round(h * 60),
      targetDate: target === '' ? null : target,
      notes,
    }))
  }

  return (
    <Form onSubmit={submit}>
      <label className="block text-sm font-medium">Chapter name
        <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Weight (optional)
          <input className={fieldCls} inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} aria-describedby="w-help" />
          <span id="w-help" className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
            Relative importance, e.g. marks. Leave empty if unknown: it counts as 1 and is never invented.
          </span>
        </label>
        <label className="block text-sm font-medium">Estimated hours (optional)
          <input className={fieldCls} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
      </div>
      <label className="block text-sm font-medium">Target completion date (optional)
        <input className={fieldCls} type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
      <label className="block text-sm font-medium">Notes
        <textarea className={fieldCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <Footer busy={busy} error={error} submitLabel={submitLabel} onCancel={onCancel} />
    </Form>
  )
}

const LEVELS = ['1', '2', '3', '4', '5']

export function TopicForm({ initial, submitLabel, onSave, onCancel }: FormProps<TopicDraft>) {
  const [name, setName] = useState(initial.name)
  const [status, setStatus] = useState<TopicStatus>(initial.status)
  const [percent, setPercent] = useState(String(initial.contentPercent))
  const [difficulty, setDifficulty] = useState(initial.difficulty === null ? '' : String(initial.difficulty))
  const [importance, setImportance] = useState(initial.importance === null ? '' : String(initial.importance))
  const [minutes, setMinutes] = useState(initial.estimatedMinutes === null ? '' : String(initial.estimatedMinutes))
  const [notes, setNotes] = useState(initial.notes)
  const { busy, error, run } = useSubmit()

  // practised / revised are legacy fields: kept as stored, no longer edited here (activities replace them).
  const submit = () => void run(() => onSave({
    name: name.trim(), status,
    contentPercent: percent.trim() === '' ? NaN : Number(percent),
    practised: initial.practised, revised: initial.revised,
    difficulty: optNumber(difficulty), importance: optNumber(importance),
    estimatedMinutes: optNumber(minutes), notes,
  }))

  return (
    <Form onSubmit={submit}>
      <label className="block text-sm font-medium">Topic name
        <input className={fieldCls} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">Status
          <select className={fieldCls} value={status} onChange={(e) => setStatus(e.target.value as TopicStatus)}>
            {TOPIC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select></label>
        <label className="block text-sm font-medium">Content studied (%)
          <input className={fieldCls} inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} /></label>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Practice, revision, tests and the rest are tracked per chapter as activities, so nothing is counted twice.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium">Difficulty
          <select className={fieldCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Unknown</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}{l === '1' ? ' (easy)' : l === '5' ? ' (hard)' : ''}</option>)}
          </select></label>
        <label className="block text-sm font-medium">Importance
          <select className={fieldCls} value={importance} onChange={(e) => setImportance(e.target.value)}>
            <option value="">Unknown</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l}{l === '1' ? ' (low)' : l === '5' ? ' (high)' : ''}</option>)}
          </select></label>
        <label className="block text-sm font-medium">Estimated minutes
          <input className={fieldCls} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
      </div>
      <label className="block text-sm font-medium">Notes
        <textarea className={fieldCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <Footer busy={busy} error={error} submitLabel={submitLabel} onCancel={onCancel} />
    </Form>
  )
}

export function BulkTopicsForm({ onSave, onClose }: {
  onSave: (text: string) => Promise<{ added: number; skipped: string[] }>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ added: number; skipped: string[] } | null>(null)
  const { busy, error, run } = useSubmit()

  if (result) {
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm">
          Added {result.added} topic(s).
          {result.skipped.length > 0 && ` Skipped ${result.skipped.length} duplicate(s): ${result.skipped.join(', ')}.`}
        </p>
        <div className="flex justify-end"><button className={primaryBtn} onClick={onClose}>Done</button></div>
      </div>
    )
  }
  return (
    <Form onSubmit={() => void run(async () => setResult(await onSave(text)))}>
      <label className="block text-sm font-medium">Topics, one per line
        <textarea className={fieldCls} rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <Footer busy={busy} error={error} submitLabel="Add topics" onCancel={onClose} />
    </Form>
  )
}
