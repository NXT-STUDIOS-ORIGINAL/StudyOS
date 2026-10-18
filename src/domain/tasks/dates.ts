import { addDays, differenceInCalendarDays, format, getDay, parse } from 'date-fns'

const FMT = 'yyyy-MM-dd'
const parseDay = (d: string): Date => parse(d, FMT, new Date(0))

/** The user's local calendar date, so tasks follow the clock on the device. */
export const todayString = (now: Date = new Date()): string => format(now, FMT)

export const addDaysString = (d: string, n: number): string => format(addDays(parseDay(d), n), FMT)

/** 0 = Sunday ... 6 = Saturday */
export const weekdayOf = (d: string): number => getDay(parseDay(d))

export const daysFrom = (start: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => addDaysString(start, i))

export const formatDay = (d: string, pattern: string): string => format(parseDay(d), pattern)

export function dueLabel(due: string | null, today: string): string {
  if (due === null) return 'No date'
  const diff = differenceInCalendarDays(parseDay(due), parseDay(today))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff < 0) return `Overdue by ${-diff} day${diff === -1 ? '' : 's'}`
  return format(parseDay(due), 'EEE d MMM')
    }
