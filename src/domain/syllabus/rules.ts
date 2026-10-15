import { isValid, parse } from 'date-fns'
import type { ChapterDraft, SubjectDraft, TopicDraft, TopicStatus } from './types'
import { TOPIC_STATUSES } from './types'

export const MAX_NAME = 100
export const MAX_NOTES = 5000

export const normName = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function hasDuplicateName(
  name: string,
  siblings: { id: string; name: string }[],
  excludeId?: string,
): boolean {
  const key = normName(name)
  return siblings.some((s) => s.id !== excludeId && normName(s.name) === key)
}

export const isValidDateString = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(parse(s, 'yyyy-MM-dd', new Date(0)))

export const isHexColor = (s: string): boolean => /^#[0-9a-fA-F]{6}$/.test(s)

const okOptInt = (v: number | null, min: number, max: number): boolean =>
  v === null || (Number.isInteger(v) && v >= min && v <= max)

function nameErrors(label: string, name: string): string[] {
  if (name.trim().length === 0) return [`${label} is required.`]
  if (name.trim().length > MAX_NAME) return [`${label} must be ${MAX_NAME} characters or fewer.`]
  return []
}

export function validateSubjectDraft(d: SubjectDraft): string[] {
  const errs = nameErrors('Subject name', d.name)
  if (!isHexColor(d.color)) errs.push('Choose one of the colours.')
  return errs
}

export function validateChapterDraft(d: ChapterDraft): string[] {
  const errs = nameErrors('Chapter name', d.name)
  if (d.weight !== null && !(Number.isFinite(d.weight) && d.weight > 0 && d.weight <= 1000))
    errs.push('Weight must be a number above 0 (up to 1000), or left empty if unknown.')
  if (!okOptInt(d.estimatedMinutes, 0, 600000))
    errs.push('Estimated time must be a valid number of hours, or left empty.')
  if (d.targetDate !== null && !isValidDateString(d.targetDate)) errs.push('Target date is not a valid date.')
  if (d.notes.length > MAX_NOTES) errs.push(`Notes must be ${MAX_NOTES} characters or fewer.`)
  return errs
}

export function validateTopicDraft(d: TopicDraft): string[] {
  const errs = nameErrors('Topic name', d.name)
  if (!TOPIC_STATUSES.includes(d.status)) errs.push('Unknown status.')
  if (!okOptInt(d.contentPercent, 0, 100)) errs.push('Content studied must be a whole number from 0 to 100.')
  if (!okOptInt(d.difficulty, 1, 5)) errs.push('Difficulty must be 1 to 5, or unknown.')
  if (!okOptInt(d.importance, 1, 5)) errs.push('Importance must be 1 to 5, or unknown.')
  if (!okOptInt(d.estimatedMinutes, 0, 600000)) errs.push('Estimated time must be a whole number of minutes, or left empty.')
  if (d.notes.length > MAX_NOTES) errs.push(`Notes must be ${MAX_NOTES} characters or fewer.`)
  return errs
}

export const emptyChapterDraft = (): ChapterDraft => ({
  name: '', weight: null, estimatedMinutes: null, targetDate: null, notes: '',
})

export const emptyTopicDraft = (): TopicDraft => ({
  name: '', status: 'not-started', contentPercent: 0, practised: false, revised: false,
  difficulty: null, importance: null, estimatedMinutes: null, notes: '',
})

/**
 * Keeps status, percent and completion date consistent:
 * - "completed" means 100% studied; "not started" means 0%
 * - lowering the percent of a completed topic moves it back to "learning"
 * - completedAt is set when a topic becomes completed and cleared when it stops being so
 */
export function applyTopicRules(
  input: { status: TopicStatus; contentPercent: number },
  prevStatus: TopicStatus | null,
  prevCompletedAt: number | null,
  now: number,
): { status: TopicStatus; contentPercent: number; completedAt: number | null } {
  let { status, contentPercent } = input
  if (status === 'completed' && prevStatus === 'completed' && contentPercent < 100) status = 'learning'
  else if (status === 'completed') contentPercent = 100
  else if (status === 'not-started') contentPercent = 0
  const completedAt = status === 'completed' ? (prevStatus === 'completed' && prevCompletedAt !== null ? prevCompletedAt : now) : null
  return { status, contentPercent, completedAt }
}
