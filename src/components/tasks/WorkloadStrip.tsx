import { formatDay, type } from './workloadFormat'
import type { DayLoad } from '../../domain/tasks/planner'

const TONE: Record<DayLoad['state'], string> = {
  free: 'border-slate-200 dark:border-slate-800',
  ok: 'border-green-300 dark:border-green-800',
  over: 'border-red-400 dark:border-red-700',
  rest: 'border-amber-400 dark:border-amber-700',
}

export function WorkloadStrip({ loads }: { loads: DayLoad[] }) {
  const over = loads.filter((l) => l.state === 'over')
  const rest = loads.filter((l) => l.state === 'rest')
  return (
    <section aria-label="Workload for the next 7 days" className="space-y-2">
      <h2 className="text-lg font-semibold">Next 7 days</h2>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {loads.map((l) => (
          <li key={l.date} className={`rounded-lg border p-2 text-center text-xs ${TONE[l.state]}`}>
            <span className="block font-medium">{formatDay(l.date)}</span>
            <span className="block">{type(l)}</span>
          </li>
        ))}
      </ul>
      {over.length > 0 && (
        <p role="status" className="text-sm text-red-700 dark:text-red-300">
          Planned time is above your daily goal on {over.map((l) => formatDay(l.date)).join(', ')}. Shorten
          or move some tasks. StudyOS never reschedules for you.
        </p>
      )}
      {rest.length > 0 && (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
          Work is due on days you did not choose as study days: {rest.map((l) => formatDay(l.date)).join(', ')}.
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Compares planned minutes of unfinished tasks with your daily goal on your study days (Settings).
        Tasks without planned minutes are counted but add no time.
      </p>
    </section>
  )
}
