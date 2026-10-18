import type { Task, TaskPriority } from './types'

const RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 }

/** Earliest due date first (no date last), then priority, then oldest first. */
export function compareTasks(a: Task, b: Task): number {
  return (
    (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99') ||
    RANK[a.priority] - RANK[b.priority] ||
    a.createdAt - b.createdAt
  )
}

export interface TaskGroups {
  overdue: Task[]
  today: Task[]
  upcoming: Task[]
  undated: Task[]
  done: Task[]
}

/** A task is overdue only if it is still to do and its due date is before today. Nothing changes by itself. */
export function groupTasks(tasks: Task[], today: string): TaskGroups {
  const g: TaskGroups = { overdue: [], today: [], upcoming: [], undated: [], done: [] }
  for (const t of [...tasks].sort(compareTasks)) {
    if (t.status === 'done') g.done.push(t)
    else if (t.dueDate === null) g.undated.push(t)
    else if (t.dueDate < today) g.overdue.push(t)
    else if (t.dueDate === today) g.today.push(t)
    else g.upcoming.push(t)
  }
  g.done.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  return g
}

export interface DayLoad {
  date: string
  plannedMinutes: number
  unestimated: number // tasks due that day with no planned time
  capacityMinutes: number
  state: 'free' | 'ok' | 'over' | 'rest'
}

/**
 * Planned time of unfinished tasks per due date, compared with the time you said you have.
 * "rest" = work is due on a day that is not one of your study days. Only reports, never reschedules.
 */
export function workloadForDays(
  tasks: Task[],
  dates: string[],
  capacity: (date: string) => number,
): DayLoad[] {
  return dates.map((date) => {
    const due = tasks.filter((t) => t.status === 'todo' && t.dueDate === date)
    const plannedMinutes = due.reduce((n, t) => n + (t.plannedMinutes ?? 0), 0)
    const unestimated = due.filter((t) => t.plannedMinutes === null).length
    const capacityMinutes = capacity(date)
    let state: DayLoad['state'] = 'ok'
    if (due.length === 0) state = 'free'
    else if (capacityMinutes === 0) state = 'rest'
    else if (plannedMinutes > capacityMinutes) state = 'over'
    return { date, plannedMinutes, unestimated, capacityMinutes, state }
  })
}
