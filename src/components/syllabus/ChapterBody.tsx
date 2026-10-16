import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { STATUS_LABELS, TOPIC_STATUSES, type Chapter, type Topic, type TopicStatus } from '../../domain/syllabus/types'
import { IconBtn } from '../IconBtn'
import { secondaryBtn } from '../ui'

interface Props {
  chapter: Chapter
  index: number
  count: number
  topics: Topic[]
  onAddTopic: () => void
  onBulk: () => void
  onEdit: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onTopicStatus: (id: string, status: TopicStatus) => void
  onTopicEdit: (id: string) => void
  onTopicDelete: (id: string) => void
  onTopicMove: (id: string, dir: -1 | 1) => void
}

export function ChapterBody(p: Props) {
  const { chapter: ch, topics: ts } = p
  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button className={secondaryBtn} onClick={p.onAddTopic}>Add topic</button>
        <button className={secondaryBtn} onClick={p.onBulk}>Add many</button>
        <span className="ml-auto flex">
          <IconBtn label={`Move ${ch.name} earlier`} disabled={p.index === 0} onClick={() => p.onMove(-1)}><ArrowUp size={18} aria-hidden /></IconBtn>
          <IconBtn label={`Move ${ch.name} later`} disabled={p.index === p.count - 1} onClick={() => p.onMove(1)}><ArrowDown size={18} aria-hidden /></IconBtn>
          <IconBtn label={`Edit chapter ${ch.name}`} onClick={p.onEdit}><Pencil size={18} aria-hidden /></IconBtn>
          <IconBtn label={`Delete chapter ${ch.name}`} onClick={p.onDelete}><Trash2 size={18} aria-hidden /></IconBtn>
        </span>
      </div>
      {ch.notes && <p className="text-sm text-slate-600 dark:text-slate-400">{ch.notes}</p>}
      {ts.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-400">No topics yet.</p> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {ts.map((t, ti) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-1">
              <span className="min-w-0 flex-1 text-sm">
                {t.name}
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t.contentPercent}% studied</span>
              </span>
              <select aria-label={`Status of ${t.name}`} value={t.status}
                onChange={(e) => p.onTopicStatus(t.id, e.target.value as TopicStatus)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                {TOPIC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <IconBtn label={`Move ${t.name} earlier`} disabled={ti === 0} onClick={() => p.onTopicMove(t.id, -1)}><ArrowUp size={18} aria-hidden /></IconBtn>
              <IconBtn label={`Move ${t.name} later`} disabled={ti === ts.length - 1} onClick={() => p.onTopicMove(t.id, 1)}><ArrowDown size={18} aria-hidden /></IconBtn>
              <IconBtn label={`Edit topic ${t.name}`} onClick={() => p.onTopicEdit(t.id)}><Pencil size={18} aria-hidden /></IconBtn>
              <IconBtn label={`Delete topic ${t.name}`} onClick={() => p.onTopicDelete(t.id)}><Trash2 size={18} aria-hidden /></IconBtn>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
