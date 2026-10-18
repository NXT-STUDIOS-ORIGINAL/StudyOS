import { formatDay as fmt } from '../../domain/tasks/dates'
import type { DayLoad } from '../../domain/tasks/planner'

export const formatDay = (d: string): string => fmt(d, 'EEE d')

const hours = (m: number): string => `${(m / 60).toFixed(1)}h`

/** One short line for a day card. */
export function type(l: DayLoad): string {
  if (l.state === 'free') return 'free'
  const planned = `${hours(l.plannedMinutes)}${l.unestimated > 0 ? '+' : ''}`
  return l.state === 'rest' ? `${planned} (rest day)` : `${planned} / ${hours(l.capacityMinutes)}`
}
