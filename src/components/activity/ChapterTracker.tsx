import { useId, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { Pin } from 'lucide-react'
import type { Chapter } from '../../domain/syllabus/types'
import type { ActivityRecord, ActivityStatus, ActivityType } from '../../domain/activity/types'
import {
  buildSlots, CHAPTER_STATUS_LABELS, chapterStatus, completion, latestCompletion, tally,
} from '../../domain/activity/progress'
import { nextDueActivity } from '../../domain/tracker/tracker'
import { IconBtn } from '../IconBtn'
import { ProgressBar } from '../ProgressBar'

interface Props {
  chapter: Chapter
  number: number
  types: ActivityType[] // all of this subject's activities
  records: ActivityRecord[] // this chapter's records
  detailed: boolean
  pending: ReadonlySet<string> // "chapterId|typeId" keys with a save in flight
  onSet: (typeId: string, to: ActivityStatus) => void
  onTogglePin: () => void
  children: ReactNode
}

function Chip({ type, record, busy, showDate, onToggle }: {
  type: ActivityType; record: ActivityRecord | undefined; busy: boolean; showDate: boolean
  onToggle: (to: ActivityStatus) => void
}) {
  const status: ActivityStatus = record?.status ?? 'todo'
  const done = status === 'done'
  return (
    <li>
      <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm focus-within:outline-2 focus-within:outline-indigo-500 ${
        done ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950'
          : 'border-slate-300 dark:border-slate-700'} ${status === 'na' ? 'opacity-50' : ''}`}>
        <input type="checkbox" className="h-5 w-5 shrink-0" checked={done} disabled={status === 'na' || busy}
          onChange={(e) => onToggle(e.target.checked ? 'done' : 'todo')} />
        <span className={status === 'na' ? 'line-through' : ''}>{type.name}</span>
        {showDate && done && record?.completedAt != null && (
          <span className="text-xs text-slate-500 dark:text-slate-400">{format(record.completedAt, 'd MMM')}</span>
        )}
      </label>
    </li>
  )
}

export function ChapterTracker({ chapter, number, types, records, detailed, pending, onSet, onTogglePin, children }: Props) {
  const [expanded, setExpanded] = useState(detailed)
  const panelId = useId()
  const enabled = types.filter((t) => t.enabled)
  const onCard = enabled.filter((t) => t.showInCompact !== false)
  const more = enabled.filter((t) => t.showInCompact === false)
  const slots = buildSlots(enabled, [chapter], records)
  const t = tally(slots)
  const status = chapterStatus(slots)
  const next = nextDueActivity(enabled, records)
  const last = latestCompletion(records, enabled.map((x) => x.id))
  const byType = new Map(records.map((r) => [r.activityTypeId, r]))
  const busy = (typeId: string) => pending.has(`${chapter.id}|${typeId}`)
  const chip = (a: ActivityType) => (
    <Chip key={a.id} type={a} record={byType.get(a.id)} busy={busy(a.id)} showDate={detailed}
      onToggle={(to) => onSet(a.id, to)} />
  )

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-1 p-2 pl-3">
        <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded((v) => !v)}
          className="min-h-11 min-w-0 flex-1 py-1 text-left">
          <span className="block font-medium">{number}. {chapter.name}</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {CHAPTER_STATUS_LABELS[status]}
            {t.applicable > 0 && ` · ${t.done}/${t.applicable}`}
            {next && ` · next: ${next.name}`}
            {chapter.targetDate && ` · target ${chapter.targetDate}`}
            {last !== null && ` · last ${format(last, 'd MMM')}`}
          </span>
        </button>
        <span className="w-16 shrink-0 pt-4"><ProgressBar value={completion(t).unweighted} label={`${chapter.name} activity completion`} /></span>
        <IconBtn label={`${chapter.pinned ? 'Unpin' : 'Pin'} ${chapter.name}`} pressed={chapter.pinned === true} onClick={onTogglePin}>
          <Pin size={18} aria-hidden />
        </IconBtn>
      </div>

      {onCard.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-3 pb-3" aria-label={`Activities for ${chapter.name}`}>{onCard.map(chip)}</ul>
      )}

      {expanded && (
        <div id={panelId} className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-800">
          {enabled.length === 0 && (
            <p className="text-sm text-slate-600 dark:text-slate-400">No activities are enabled for this subject. Use “Customise activities”.</p>
          )}
          {more.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">More activities</p>
              <ul className="flex flex-wrap gap-2">{more.map(chip)}</ul>
            </div>
          )}
          {enabled.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Not applicable to this chapter</legend>
              <div className="flex flex-wrap gap-x-4">
                {enabled.map((a) => (
                  <label key={a.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" className="h-5 w-5" checked={byType.get(a.id)?.status === 'na'} disabled={busy(a.id)}
                      onChange={(e) => onSet(a.id, e.target.checked ? 'na' : 'todo')} />
                    {a.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {children}
        </div>
      )}
    </div>
  )
                             }
