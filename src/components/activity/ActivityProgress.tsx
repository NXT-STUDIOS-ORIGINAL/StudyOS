import type { ActivityType } from '../../domain/activity/types'
import {
  COMPLETION_EXPLANATION, COVERAGE_EXPLANATION, NOT_MASTERY_NOTE,
  completion, coverage, perType, tally, type Slot,
} from '../../domain/activity/progress'
import { formatPercent } from '../../domain/syllabus/progress'
import { ProgressBar } from '../ProgressBar'

interface Props { slots: Slot[]; types: ActivityType[]; chapterIds: string[]; overall: Slot[] }

export function ActivityProgress({ slots, types, chapterIds, overall }: Props) {
  const t = tally(slots)
  const comp = completion(t)
  const cov = coverage(slots, chapterIds)
  const rows = perType(slots, types)
  const all = completion(tally(overall))

  return (
    <section aria-label="Activity progress" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold">Activity progress</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-sm font-medium">Activity completion</p>
          <ProgressBar value={comp.unweighted} label="Activity completion, unweighted" />
          <p className="text-sm">{formatPercent(comp.unweighted)} <span className="text-xs text-slate-500 dark:text-slate-400">unweighted</span></p>
          <p className="text-sm">{formatPercent(comp.weighted)} <span className="text-xs text-slate-500 dark:text-slate-400">weighted</span></p>
        </div>
        <div>
          <p className="text-sm font-medium">Chapter coverage</p>
          <ProgressBar value={cov.coverage} label="Chapter coverage" />
          <p className="text-sm">{formatPercent(cov.coverage)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cov.touched} of {cov.withApplicable} started · {cov.complete} fully done
          </p>
        </div>
        <div>
          <p className="text-sm font-medium">All subjects</p>
          <p className="text-sm">{formatPercent(all.unweighted)} <span className="text-xs text-slate-500 dark:text-slate-400">unweighted</span></p>
          <p className="text-sm">{formatPercent(all.weighted)} <span className="text-xs text-slate-500 dark:text-slate-400">weighted</span></p>
        </div>
      </div>
      {cov.withoutApplicable > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {cov.withoutApplicable} chapter(s) have no applicable activities and are left out, not counted as complete.
        </p>
      )}
      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.typeId} className="grid grid-cols-[1fr,auto] items-center gap-x-3 text-sm sm:grid-cols-[14rem,1fr,auto]">
              <span>{r.name}</span>
              <span className="hidden sm:block"><ProgressBar value={r.ratio} label={`${r.name} progress`} /></span>
              <span className="text-slate-600 dark:text-slate-400">
                {r.applicable === 0 ? 'no applicable chapters' : `${r.done} of ${r.applicable} chapters`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">How is this calculated?</summary>
        <p className="mt-1">{COMPLETION_EXPLANATION}</p>
        <p className="mt-2">{COVERAGE_EXPLANATION}</p>
        <p className="mt-2">{NOT_MASTERY_NOTE}</p>
      </details>
    </section>
  )
}
