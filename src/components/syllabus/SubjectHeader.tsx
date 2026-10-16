import { ArrowDown, ArrowUp, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import type { Subject } from '../../domain/syllabus/types'
import { IconBtn } from '../IconBtn'
import { secondaryBtn } from '../ui'

const PRESSED = 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950'
const UNPRESSED = 'border-slate-300 dark:border-slate-700'

interface Props {
  subjects: Subject[] // display order, pinned first
  subject: Subject
  canMoveEarlier: boolean
  canMoveLater: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onPin: () => void
  onMove: (dir: -1 | 1) => void
  onEdit: () => void
  onDelete: () => void
}

export function SubjectHeader(p: Props) {
  const { subject } = p
  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Subjects">
        {p.subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === subject.id}
            onClick={() => p.onSelect(s.id)}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
              s.id === subject.id ? PRESSED : UNPRESSED
            }`}
          >
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
            {s.pinned && <Pin size={12} aria-label="pinned" />}
          </button>
        ))}
        <button type="button" className={`${secondaryBtn} gap-1`} onClick={p.onNew}>
          <Plus size={16} aria-hidden /> Subject
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <h2 className="mr-auto text-xl font-semibold">{subject.name}</h2>
        <IconBtn
          label={subject.pinned ? 'Unpin subject' : 'Pin subject'}
          pressed={subject.pinned === true}
          onClick={p.onPin}
        >
          <Pin size={18} aria-hidden />
        </IconBtn>
        <IconBtn label="Move subject earlier" disabled={!p.canMoveEarlier} onClick={() => p.onMove(-1)}>
          <ArrowUp size={18} aria-hidden />
        </IconBtn>
        <IconBtn label="Move subject later" disabled={!p.canMoveLater} onClick={() => p.onMove(1)}>
          <ArrowDown size={18} aria-hidden />
        </IconBtn>
        <IconBtn label="Edit subject" onClick={p.onEdit}>
          <Pencil size={18} aria-hidden />
        </IconBtn>
        <IconBtn label="Delete subject" onClick={p.onDelete}>
          <Trash2 size={18} aria-hidden />
        </IconBtn>
      </div>
    </>
  )
}
