import type { Subject } from '../../domain/syllabus/types'
import { fieldCls, secondaryBtn } from '../ui'

interface Props {
  subjects: Subject[]
  subjectName: string
  defaultSubjectId: string | null
  onDefault: (id: string | null) => void
  onCustomise: (scope: string | null) => void
  subjectId: string
  onReset: () => void
}

export function TrackerPreferences(p: Props) {
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Tracker preferences</summary>
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap gap-2">
          <button className={secondaryBtn} onClick={() => p.onCustomise(p.subjectId)}>
            Customise activities for {p.subjectName}
          </button>
          <button className={secondaryBtn} onClick={() => p.onCustomise(null)}>
            Default set for new subjects
          </button>
        </div>
        <label className="block text-sm font-medium">
          Open the tracker on
          <select
            className={fieldCls}
            value={p.defaultSubjectId ?? ''}
            onChange={(e) => p.onDefault(e.target.value === '' ? null : e.target.value)}
          >
            <option value="">The subject I used last</option>
            {p.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Layout, filter and last subject are remembered automatically.
        </p>
        <button className={secondaryBtn} onClick={p.onReset}>
          Reset tracker preferences
        </button>
      </div>
    </details>
  )
}
