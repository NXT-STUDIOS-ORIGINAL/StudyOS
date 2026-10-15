import type { Chapter, Topic } from '../../domain/syllabus/types'
import {
  COUNT_EXPLANATION, formatPercent, meanProgress, remainingContentMinutes,
  weightedExplanation, weightedProgress, type WeightBasis,
} from '../../domain/syllabus/progress'
import { fieldCls } from '../ui'
import { ProgressBar } from '../ProgressBar'

interface Props { chapters: Chapter[]; topics: Topic[]; basis: WeightBasis; onBasis: (b: WeightBasis) => void }

export function ProgressPanel({ chapters, topics, basis, onBasis }: Props) {
  const remaining = remainingContentMinutes(topics)
  const count = meanProgress(topics, 'content')
  const w = weightedProgress(chapters, topics, 'content', basis)
  return (
    <section aria-label="Topic content progress" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Topic content studied</h2>
        <label className="text-sm font-medium">Weight chapters by
          <select className={`${fieldCls} w-auto`} value={basis} onChange={(e) => onBasis(e.target.value as WeightBasis)}>
            <option value="weight">Custom chapter weight</option>
            <option value="hours">Estimated hours</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><p className="text-sm font-medium">By topic count</p><ProgressBar value={count} label="Content studied by topic count" /><p className="text-sm">{formatPercent(count)}</p></div>
        <div><p className="text-sm font-medium">Weighted</p><ProgressBar value={w.value} label="Content studied weighted" /><p className="text-sm">{formatPercent(w.value)}</p></div>
      </div>
      {w.excluded > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Weighted view uses {w.included} of {chapters.length} chapters; {w.excluded} left out (no topics, or no weight/hours data).
        </p>
      )}
      <p className="text-sm">
        Estimated study time left: <strong>{(remaining.minutes / 60).toFixed(1)} h</strong>
        {remaining.withoutEstimate > 0 && ` (${remaining.withoutEstimate} topic(s) have no estimate and are not counted)`}
      </p>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">How is this calculated?</summary>
        <p className="mt-1">{COUNT_EXPLANATION.split('“Practised”')[0].trim()}</p>
        <p className="mt-2">{weightedExplanation(basis)}</p>
      </details>
    </section>
  )
}
