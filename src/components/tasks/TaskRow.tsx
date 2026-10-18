import { Pencil, Trash2 } from 'lucide-react'
import { dueLabel } from '../../domain/tasks/dates'
import { PRIORITY_LABELS, type Task } from '../../domain/tasks/types'
import { IconBtn } from '../IconBtn'

interface Props {
  task: Task
  where: string | null // "Subject · Chapter"
  today: string
  busy: boolean
  onToggle: (done: boolean) => void
  onEdit: () => void
  onDelete: () => void
}

export function TaskRow({ task, where, today, busy, onToggle, onEdit, onDelete }: Props) {
  const done = task.status === 'done'
  const overdue = !done && task.dueDate !== null && task.dueDate < today
  const meta = [
    done ? 'Done' : dueLabel(task.dueDate, today),
    task.priority === 'normal' ? null : `${PRIORITY_LABELS[task.priority]} priority`,
    task.plannedMinutes === null ? null : `${task.plannedMinutes} min planned`,
    where,
  ].filter(Boolean)

  return (
    <li className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white pl-3 dark:border-slate-800 dark:bg-slate-900">
      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0"
          checked={done}
          disabled={busy}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="min-w-0">
          <span className={`block text-sm ${done ? 'text-slate-400 line-through' : ''}`}>{task.title}</span>
          <span
            className={`block text-xs ${overdue ? 'text-red-700 dark:text-red-300' : 'text-slate-500 dark:text-slate-400'}`}
          >
            {meta.join(' · ')}
          </span>
        </span>
      </label>
      <IconBtn label={`Edit task ${task.title}`} onClick={onEdit}>
        <Pencil size={18} aria-hidden />
      </IconBtn>
      <IconBtn label={`Delete task ${task.title}`} onClick={onDelete}>
        <Trash2 size={18} aria-hidden />
      </IconBtn>
    </li>
  )
}
