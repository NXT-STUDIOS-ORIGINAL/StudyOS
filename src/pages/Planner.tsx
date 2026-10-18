import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Profile, ProfileSettings } from '../domain/types'
import { addDaysString, daysFrom, todayString, weekdayOf } from '../domain/tasks/dates'
import { groupTasks, workloadForDays } from '../domain/tasks/planner'
import { emptyTaskDraft } from '../domain/tasks/rules'
import type { Task } from '../domain/tasks/types'
import { useSyllabus } from '../hooks/useSyllabus'
import { useTasks } from '../hooks/useTasks'
import { useTaskToggle } from '../hooks/useTaskToggle'
import { createTask } from '../lib/taskRepo'
import { Toast } from '../components/Toast'
import { QuickAddTask, type DueChoice } from '../components/tasks/QuickAddTask'
import { TaskDialogs, type TaskDlg } from '../components/tasks/TaskDialogs'
import { TaskRow } from '../components/tasks/TaskRow'
import { WorkloadStrip } from '../components/tasks/WorkloadStrip'
import { fieldCls, primaryBtn, secondaryBtn } from '../components/ui'

interface Props { profile: Profile; settings: ProfileSettings }

export function PlannerPage({ profile, settings }: Props) {
  const pid = profile.id
  const tasks = useTasks(pid)
  const syllabus = useSyllabus(pid)
  const [filter, setFilter] = useState('all')
  const [dlg, setDlg] = useState<TaskDlg>(null)
  const { pending, toast, closeToast, toggle } = useTaskToggle(pid)

  if (!tasks || !syllabus) return <p role="status">Loading…</p>

  const today = todayString()
  const { subjects, chapters } = syllabus
  const shown = filter === 'all' ? tasks : tasks.filter((t) => t.subjectId === filter)
  const groups = groupTasks(shown, today)
  const capacity = (d: string) =>
    settings.preferredDays.includes(weekdayOf(d)) ? settings.dailyTargetMinutes : 0
  const loads = workloadForDays(shown, daysFrom(today, 7), capacity)

  const whereOf = (t: Task): string | null => {
    const s = subjects.find((x) => x.id === t.subjectId)?.name
    const c = chapters.find((x) => x.id === t.chapterId)?.name
    return [s, c].filter(Boolean).join(' · ') || null
  }

  const row = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      where={whereOf(t)}
      today={today}
      busy={pending.has(t.id)}
      onToggle={(done) => void toggle(t, done)}
      onEdit={() => setDlg({ kind: 'edit', id: t.id })}
      onDelete={() => setDlg({ kind: 'delete', id: t.id })}
    />
  )

  const section = (title: string, list: Task[], action?: React.ReactNode) =>
    list.length === 0 ? null : (
      <section aria-label={title} className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {title} <span className="text-sm font-normal text-slate-500 dark:text-slate-400">{list.length}</span>
          </h2>
          {action}
        </div>
        <ul className="space-y-2">{list.map(row)}</ul>
      </section>
    )

  async function add(title: string, due: DueChoice) {
    const dueDate = due === 'today' ? today : due === 'tomorrow' ? addDaysString(today, 1) : null
    await createTask(pid, {
      ...emptyTaskDraft(),
      title,
      dueDate,
      subjectId: filter === 'all' ? null : filter,
    })
  }

  const empty = tasks.length === 0

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Planner</h1>
        <button className={`${primaryBtn} inline-flex items-center gap-1`} onClick={() => setDlg({ kind: 'new' })}>
          <Plus size={16} aria-hidden /> Task with details
        </button>
      </div>

      <QuickAddTask onAdd={add} />

      <label className="block max-w-xs text-sm font-medium">
        Subject
        <select className={fieldCls} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <WorkloadStrip loads={loads} />

      {empty && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No tasks yet. Type one above and press Enter. Tasks stay on this device and are included in your backups.
        </p>
      )}

      {section(
        'Overdue',
        groups.overdue,
        <button className={secondaryBtn} onClick={() => setDlg({ kind: 'reschedule' })}>
          Move to today
        </button>,
      )}
      {section('Today', groups.today)}
      {section('Upcoming', groups.upcoming)}
      {section('No date', groups.undated)}
      {groups.done.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
            Done ({groups.done.length})
          </summary>
          <ul className="space-y-2 pt-2">{groups.done.slice(0, 30).map(row)}</ul>
        </details>
      )}

      <TaskDialogs
        dlg={dlg}
        onClose={() => setDlg(null)}
        profileId={pid}
        tasks={tasks}
        subjects={subjects}
        chapters={chapters}
        today={today}
        overdueIds={groups.overdue.map((t) => t.id)}
        defaultSubjectId={filter === 'all' ? null : filter}
      />
      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}
