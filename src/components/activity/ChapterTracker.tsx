import type { ReactNode } from 'react'
import { format } from 'date-fns'
import type { Chapter } from '../../domain/syllabus/types'
import type { ActivityRecord, ActivityStatus, ActivityType } from '../../domain/activity/types'
import {
  buildSlots, CHAPTER_STATUS_LABELS, chapterStatus, completion, latestCompletion, tally,
} from '../../domain/activity/progress'
import { ProgressBar } from '../ProgressBar'

interface Props {
  chapter: Chapter
  number: number
  types: ActivityType[] // this subject's activities (enabled ones are shown)
  records: ActivityRecord[] // this chapter's records
  detailed: boolean
  onSet: (typeId: string, to: ActivityStatus, current: ActivityStatus) => void
  children: ReactNode
}

export function ChapterTracker({ chapter, number, types, records, detailed, onSet, children }: Props) {
  const enabled = types.filter((t) => t.enabled)
  const slots = buildSlots(enabled, [chapter], records)
  const t = tally(slots)
  const comp = completion(t)
  const status = chapterStatus(slots)
  const byType = new Map(records.map((r) => [r.activityTypeId, r]))
  const last = latestCompletion(records, enabled.map((x) => x.id))

  return (
    <details open={detailed} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
        <span className="font-medium">{number}. {chapter.name}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {CHAPTER_STATUS_LABELS[status]}
          {t.applicable > 0 && ` · ${t.done}/${t.applicable} activities`}
          {chapter.targetDate && ` · target ${chapter.targetDate}`}
          {last !== null && ` · last activity ${format(last, 'd MMM yyyy')}`}
        </span>
        <span className="ml-auto w-24"><ProgressBar value={comp.unweighted} label={`${chapter.name} activity completion`} /></span>
      </summary>
      <div className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
        {enabled.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No activities are enabled for this subject. Use “Customise activities”.</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {enabled.map((a) => {
              const r = byType.get(a.id)
              const s: ActivityStatus = r?.status ?? 'todo'
              return (
                <li key={a.id} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 dark:border-slate-700">
                  <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-sm">
                    <input type="checkbox" className="h-5 w-5 shrink-0" checked={s === 'done'} disabled={s === 'na'}
                      onChange={(e) => onSet(a.id, e.target.checked ? 'done' : 'todo', s)} />
                    <span className={s === 'na' ? 'text-slate-400 line-through' : ''}>{a.name}</span>
                    {detailed && s === 'done' && r?.completedAt !== null && r?.completedAt !== undefined && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{format(r.completedAt, 'd MMM yyyy')}</span>
                    )}
                  </label>
                  {detailed && (
                    <button type="button" aria-pressed={s === 'na'}
                      aria-label={`${a.name}: not applicable for ${chapter.name}`}
                      onClick={() => onSet(a.id, s === 'na' ? 'todo' : 'na', s)}
                      className={`min-h-11 rounded-lg px-2 text-xs font-medium ${s === 'na' ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                      N/A
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {children}
      </div>
    </details>
  )
}
