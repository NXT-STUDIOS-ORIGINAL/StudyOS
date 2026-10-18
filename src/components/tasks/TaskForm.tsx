import { useState } from 'react'
import type { Chapter, Subject } from '../../domain/syllabus/types'
import { PRIORITY_LABELS, TASK_PRIORITIES, type TaskDraft, type TaskPriority } from '../../domain/tasks/types'
import { useSubmit } from '../../hooks/useSubmit'
import { fieldCls, primaryBtn, secondaryBtn } from '../ui'

interface Props {
  initial: TaskDraft
  subjects: Subject[]
  chapters: Chapter[]
  submitLabel: string
  onSave: (d: TaskDraft) => Promise<void>
  onCancel: () => void
}

const num = (s: string): number | null => (s.trim() === '' ? null : Number(s))

export function TaskForm({ initial, subjects, chapters, submitLabel, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title)
  const [notes, setNotes] = useState(initial.notes)
  const [priority, setPriority] = useState<TaskPriority>(initial.priority)
  const [subjectId, setSubjectId] = useState(initial.subjectId ?? '')
  const [chapterId, setChapterId] = useState(initial.chapterId ?? '')
  const [planned, setPlanned] = useState(initial.plannedMinutes === null ? '' : String(initial.plannedMinutes))
  const [actual, setActual] = useState(initial.actualMinutes === null ? '' : String(initial.actualMinutes))
  const [start, setStart] = useState(initial.startDate ?? '')
  const [due, setDue] = useState(initial.dueDate ?? '')
  const { busy, error, run } = useSubmit()
  const chapterChoices = chapters.filter((c) => c.subjectId === subjectId)

  const submit = () =>
    void run(() =>
      onSave({
        title: title.trim(),
        notes,
        priority,
        subjectId: subjectId === '' ? null : subjectId,
        chapterId: subjectId === '' || chapterId === '' ? null : chapterId,
        plannedMinutes: num(planned),
        actualMinutes: num(actual),
        startDate: start === '' ? null : start,
        dueDate: due === '' ? null : due,
      }),
    )

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="block text-sm font-medium">
        Task
        <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Subject (optional)
          <select
            className={fieldCls}
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value)
              setChapterId('')
            }}
          >
            <option value="">None</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Chapter (optional)
          <select
            className={fieldCls}
            value={chapterId}
            disabled={subjectId === ''}
            onChange={(e) => setChapterId(e.target.value)}
          >
            <option value="">None</option>
            {chapterChoices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Start date
          <input className={fieldCls} type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Due date
          <input className={fieldCls} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Planned minutes
          <input className={fieldCls} inputMode="numeric" value={planned} onChange={(e) => setPlanned(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Actual minutes
          <input className={fieldCls} inputMode="numeric" value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Priority
        <select className={fieldCls} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea className={fieldCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
