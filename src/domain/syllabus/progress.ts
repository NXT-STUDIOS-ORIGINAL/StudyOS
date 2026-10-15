import type { Chapter, Topic } from './types'

export type Dimension = 'content' | 'practice' | 'revision'
export type WeightBasis = 'weight' | 'hours'
type TopicProg = Pick<Topic, 'contentPercent' | 'practised' | 'revised'>

export const DIMENSION_LABELS: Record<Dimension, string> = {
  content: 'Content studied',
  practice: 'Questions practised',
  revision: 'Revision completed',
}

export function topicValue(t: TopicProg, d: Dimension): number {
  if (d === 'content') return t.contentPercent / 100
  if (d === 'practice') return t.practised ? 1 : 0
  return t.revised ? 1 : 0
}

/** Topic-count progress: every topic counts equally. Null when there are no topics. */
export function meanProgress(topics: TopicProg[], d: Dimension): number | null {
  if (topics.length === 0) return null
  return topics.reduce((sum, t) => sum + topicValue(t, d), 0) / topics.length
}

/** Chapter's own estimate, else the sum of its topics that have estimates, else null. */
export function chapterMinutes(
  ch: Pick<Chapter, 'estimatedMinutes'>,
  topics: Pick<Topic, 'estimatedMinutes'>[],
): number | null {
  if (ch.estimatedMinutes !== null) return ch.estimatedMinutes
  const known = topics.filter((t) => t.estimatedMinutes !== null)
  if (known.length === 0) return null
  return known.reduce((sum, t) => sum + (t.estimatedMinutes ?? 0), 0)
}

export interface WeightedResult { value: number | null; included: number; excluded: number }

/**
 * Weighted progress = sum(chapterWeight x chapterProgress) / sum(chapterWeight).
 * basis "weight": custom chapter weight, unset counts as 1.
 * basis "hours": estimated minutes; chapters with no estimate are excluded, never guessed.
 * Chapters without topics are always excluded.
 */
export function weightedProgress(
  chapters: Chapter[], topics: Topic[], d: Dimension, basis: WeightBasis,
): WeightedResult {
  let num = 0
  let den = 0
  let included = 0
  let excluded = 0
  for (const ch of chapters) {
    const own = topics.filter((t) => t.chapterId === ch.id)
    const p = meanProgress(own, d)
    const w = basis === 'weight' ? (ch.weight ?? 1) : chapterMinutes(ch, own)
    if (p === null || w === null || w <= 0) { excluded++; continue }
    num += w * p
    den += w
    included++
  }
  return { value: den > 0 ? num / den : null, included, excluded }
}

/** Study time still needed, from topic estimates only. Topics without estimates are counted, not guessed. */
export function remainingContentMinutes(
  topics: Pick<Topic, 'estimatedMinutes' | 'contentPercent'>[],
): { minutes: number; withoutEstimate: number } {
  let minutes = 0
  let withoutEstimate = 0
  for (const t of topics) {
    if (t.estimatedMinutes === null) withoutEstimate++
    else minutes += t.estimatedMinutes * (1 - t.contentPercent / 100)
  }
  return { minutes: Math.round(minutes), withoutEstimate }
}

export const formatPercent = (v: number | null): string => (v === null ? 'n/a' : `${Math.round(v * 100)}%`)

export const COUNT_EXPLANATION =
  'By topic count: every topic counts equally. “Content studied” is the average of each topic’s studied %. ' +
  '“Practised” and “Revised” are the share of topics ticked.'

export function weightedExplanation(basis: WeightBasis): string {
  return basis === 'weight'
    ? 'Weighted: each chapter’s progress is multiplied by its custom weight (unset weight counts as 1), then divided by the total weight. Chapters without topics are left out.'
    : 'Weighted: each chapter’s progress is multiplied by its estimated time, then divided by the total time. Chapters with no time estimate (and no topic estimates) are left out, not guessed.'
}
