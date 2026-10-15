import type { Chapter, Topic } from '../../domain/syllabus/types'
import {
  COUNT_EXPLANATION, DIMENSION_LABELS, formatPercent, meanProgress, remainingContentMinutes,
  weightedExplanation, weightedProgress, type Dimension, type WeightBasis,
} from '../../domain/syllabus/progress'
import { fieldCls } from '../ui'
import { ProgressBar } from '../ProgressBar'

const DIMS: Dimension[] = ['content', 'practice', 'revision']

interface Props { chapters: Chapter[]; topics: Topic[]; basis: WeightBasis; onBasis: (b: WeightBasis) => void }

export function ProgressPanel({ chapters, topics, basis, onBasis }: Props) {
  const remaining = remainingContentMinutes(topics)
  const content = weightedProgress(chapters, topics, 'content', basis)
  return (
    <section aria-label="Syllabus progress" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-semibold">Progress</h2>
        <label className="text-sm font-medium">Weight chapters by
          <select className={`${fieldCls} w-auto`} value={basis} onChange={(e) => onBasis(e.target.value as WeightBasis)}>
            <option value="weight">Custom chapter weight</option>
            <option value="hours">Estimated hours</option>
          </select>
        </label>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="py-1 font-medium">Measure</th>
            <th className="py-1 font-medium">By topic count</th>
            <th className="py-1 font-medium">Weighted</th>
          </tr>
        </thead>
        <tbody>
          {DIMS.map((d) => {
            const count = meanProgress(topics, d)
            const w = weightedProgress(chapters, topics, d, basis)
            return (
              <tr key={d} className="border-t border-slate-100 dark:border-slate-800">
                <th scope="row" className="py-2 pr-2 text-left font-normal">{DIMENSION_LABELS[d]}</th>
                <td className="py-2 pr-2"><div className="w-24"><ProgressBar value={count} label={`${DIMENSION_LABELS[d]} by topic count`} /></div>{formatPercent(count)}</td>
                <td className="py-2"><div className="w-24"><ProgressBar value={w.value} label={`${DIMENSION_LABELS[d]} weighted`} /></div>{formatPercent(w.value)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {content.excluded > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Weighted view uses {content.included} of {chapters.length} chapters; {content.excluded} left out (no topics, or no weight/hours data for this basis).
        </p>
      )}
      <p className="text-sm">
        Estimated study time left: <strong>{(remaining.minutes / 60).toFixed(1)} h</strong>
        {remaining.withoutEstimate > 0 && ` (${remaining.withoutEstimate} topic(s) have no estimate and are not counted)`}
      </p>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">How is this calculated?</summary>
        <p className="mt-1">{COUNT_EXPLANATION}</p>
        <p className="mt-2">{weightedExplanation(basis)}</p>
        <p className="mt-2">Chapters can be “fully studied” yet unpractised or unrevised, which is why they are separate rows.</p>
      </details>
    </section>
  )
}
