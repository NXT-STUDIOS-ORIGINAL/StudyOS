import {
  CHAPTER_FILTERS,
  FILTER_LABELS,
  TRACKER_VIEWS,
  type ChapterFilter,
  type TrackerView,
} from '../../domain/tracker/tracker'
import { fieldCls } from '../ui'

const PRESSED = 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950'
const UNPRESSED = 'border-slate-300 dark:border-slate-700'

interface Props {
  query: string
  onQuery: (q: string) => void
  filter: ChapterFilter
  onFilter: (f: ChapterFilter) => void
  view: TrackerView
  onView: (v: TrackerView) => void
}

export function TrackerToolbar(p: Props) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-40 flex-1 text-sm font-medium">
        Search chapters
        <input
          type="search"
          className={fieldCls}
          value={p.query}
          onChange={(e) => p.onQuery(e.target.value)}
          placeholder="Search this subject"
        />
      </label>
      <label className="text-sm font-medium">
        Show
        <select
          className={fieldCls}
          value={p.filter}
          onChange={(e) => p.onFilter(e.target.value as ChapterFilter)}
        >
          {CHAPTER_FILTERS.map((f) => (
            <option key={f} value={f}>
              {FILTER_LABELS[f]}
            </option>
          ))}
        </select>
      </label>
      <span className="flex gap-1" role="group" aria-label="Layout">
        {TRACKER_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={p.view === v}
            onClick={() => p.onView(v)}
            className={`min-h-11 rounded-lg border px-3 text-sm font-medium capitalize ${
              p.view === v ? PRESSED : UNPRESSED
            }`}
          >
            {v}
          </button>
        ))}
      </span>
    </div>
  )
}
