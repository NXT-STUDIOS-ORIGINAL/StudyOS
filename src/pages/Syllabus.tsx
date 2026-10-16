import { useCallback, useState } from 'react'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import type { Profile } from '../domain/types'
import { SUBJECT_COLORS } from '../domain/syllabus/types'
import { emptyChapterDraft, emptyTopicDraft } from '../domain/syllabus/rules'
import type { WeightBasis } from '../domain/syllabus/progress'
import { buildSlots, dedupeRecords } from '../domain/activity/progress'
import type { ActivityStatus } from '../domain/activity/types'
import {
  CHAPTER_FILTERS,
  FILTER_LABELS,
  TRACKER_VIEWS,
  filterChapters,
  type ChapterFilter,
  type TrackerView,
} from '../domain/tracker/tracker'
import { useSyllabus } from '../hooks/useSyllabus'
import { useTrackerPrefs } from '../hooks/useTrackerPrefs'
import {
  bulkAddTopics,
  createChapter,
  createSubject,
  createTopic,
  deleteChapter,
  deleteSubject,
  deleteTopic,
  moveItem,
  setTopicStatus,
  updateChapter,
  updateSubject,
  updateTopic,
  type SyllabusKind,
} from '../lib/syllabusRepo'
import {
  setActivityStatus,
  undoActivityChange,
  type ActivityChange,
} from '../lib/activityRepo'
import {
  resetTrackerPrefs,
  saveTrackerPrefs,
  setChapterPinned,
  setSubjectPinned,
  type TrackerPrefsPatch,
} from '../lib/trackerRepo'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { IconBtn } from '../components/IconBtn'
import { Modal } from '../components/Modal'
import { Toast, type ToastData } from '../components/Toast'
import { ActivityProgress } from '../components/activity/ActivityProgress'
import { ActivityTypesEditor } from '../components/activity/ActivityTypesEditor'
import { ChapterTracker } from '../components/activity/ChapterTracker'
import { ChapterBody } from '../components/syllabus/ChapterBody'
import { ProgressPanel } from '../components/syllabus/ProgressPanel'
import {
  BulkTopicsForm,
  ChapterForm,
  SubjectForm,
  TopicForm,
} from '../components/syllabus/SyllabusEditors'
import { fieldCls, primaryBtn, secondaryBtn } from '../components/ui'

type Dlg =
  | { kind: 'subject-new' }
  | { kind: 'subject-edit'; id: string }
  | { kind: 'chapter-new' }
  | { kind: 'chapter-edit'; id: string }
  | { kind: 'topic-new'; chapterId: string }
  | { kind: 'topic-edit'; id: string }
  | { kind: 'bulk'; chapterId: string }
  | { kind: 'activities'; scope: string | null }
  | { kind: 'delete'; what: SyllabusKind; id: string }
  | null

let toastSeq = 0
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'That did not work.')

const ALERT_CLS =
  'rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 ' +
  'dark:border-red-800 dark:bg-red-950 dark:text-red-200'
const MUTED_CLS = 'text-sm text-slate-600 dark:text-slate-400'
const PRESSED_CLS = 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950'
const UNPRESSED_CLS = 'border-slate-300 dark:border-slate-700'

export function SyllabusPage({ profile }: { profile: Profile }) {
  const data = useSyllabus(profile.id)
  const prefs = useTrackerPrefs(profile.id)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [basis, setBasis] = useState<WeightBasis>('weight')
  const [dlg, setDlg] = useState<Dlg>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set())
  const [toast, setToast] = useState<ToastData | null>(null)
  const closeToast = useCallback(() => setToast(null), [])

  if (!data || !prefs) return <p role="status">Loading…</p>

  const { subjects, chapters, topics, activityTypes } = data
  const records = dedupeRecords(data.activityRecords)
  const pid = profile.id
  const close = () => setDlg(null)

  const showToast = (t: Omit<ToastData, 'id'>) => setToast({ ...t, id: ++toastSeq })

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const savePrefs = (patch: TrackerPrefsPatch) => void act(() => saveTrackerPrefs(pid, patch))

  const ordered = [...subjects].sort(
    (a, b) => Number(b.pinned === true) - Number(a.pinned === true),
  )
  const preferred = prefs.defaultSubjectId ?? prefs.lastSubjectId
  const subject =
    subjects.find((s) => s.id === selected) ??
    subjects.find((s) => s.id === preferred) ??
    ordered[0]

  const selectSubject = (id: string) => {
    setSelected(id)
    setQuery('')
    savePrefs({ lastSubjectId: id })
  }

  const subjectChapters = subject ? chapters.filter((c) => c.subjectId === subject.id) : []
  const subjectTopics = topics.filter((t) => subjectChapters.some((c) => c.id === t.chapterId))
  const subjectTypes = subject ? activityTypes.filter((t) => t.subjectId === subject.id) : []
  const subjectSlots = buildSlots(subjectTypes, subjectChapters, records)
  const allSlots = buildSlots(activityTypes, chapters, records)
  const visible = filterChapters({
    chapters: subjectChapters,
    types: subjectTypes,
    records,
    query,
    filter: prefs.filter,
    today: format(new Date(), 'yyyy-MM-dd'),
  })

  /** Saves immediately with no dialog. The screen follows the database, so it never claims success early. */
  async function tick(chapterId: string, typeId: string, to: ActivityStatus) {
    const key = `${chapterId}|${typeId}`
    if (pendingKeys.has(key)) return
    setPendingKeys((prev) => new Set(prev).add(key))
    const name = activityTypes.find((t) => t.id === typeId)?.name ?? 'Activity'
    const where = chapters.find((c) => c.id === chapterId)?.name ?? ''
    try {
      const change = await setActivityStatus(pid, chapterId, typeId, to)
      if (change) {
        const what = to === 'done' ? 'done' : to === 'na' ? 'not applicable' : 'not done'
        showToast({
          message: `${name} · ${where}: ${what}`,
          actionLabel: 'Undo',
          onAction: () => void undo(change),
        })
      }
    } catch (e) {
      showToast({ message: `Not saved: ${errMsg(e)}`, tone: 'error' })
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  async function undo(change: ActivityChange) {
    try {
      const ok = await undoActivityChange(pid, change)
      showToast(
        ok
          ? { message: 'Undone' }
          : { message: 'Could not undo: it was changed again since.', tone: 'error' },
      )
    } catch (e) {
      showToast({ message: `Undo failed: ${errMsg(e)}`, tone: 'error' })
    }
  }

  const editSubject = dlg?.kind === 'subject-edit' ? subjects.find((s) => s.id === dlg.id) : undefined
  const editChapter = dlg?.kind === 'chapter-edit' ? chapters.find((c) => c.id === dlg.id) : undefined
  const editTopic = dlg?.kind === 'topic-edit' ? topics.find((t) => t.id === dlg.id) : undefined
  const newTopicIn =
    dlg?.kind === 'topic-new' ? chapters.find((c) => c.id === dlg.chapterId) : undefined
  const bulkIn = dlg?.kind === 'bulk' ? chapters.find((c) => c.id === dlg.chapterId) : undefined
  const actDlg = dlg?.kind === 'activities' ? dlg : null
  const actTypes = actDlg ? activityTypes.filter((t) => t.subjectId === actDlg.scope) : []

  let actTitle = ''
  if (actDlg) {
    const scopeName = subjects.find((s) => s.id === actDlg.scope)?.name ?? ''
    actTitle = actDlg.scope === null ? 'Default activities for new subjects' : `Activities for ${scopeName}`
  }

  const copySources: { id: string | null; label: string }[] = []
  if (actDlg) {
    if (actDlg.scope !== null) copySources.push({ id: null, label: 'Default set' })
    for (const s of subjects) {
      if (s.id !== actDlg.scope) copySources.push({ id: s.id, label: s.name })
    }
  }

  const recordCounts = new Map<string, number>()
  for (const r of records) {
    recordCounts.set(r.activityTypeId, (recordCounts.get(r.activityTypeId) ?? 0) + 1)
  }

  const del = dlg?.kind === 'delete' ? dlg : null
  let delTitle = ''
  let delBody = ''
  if (del?.what === 'subject') {
    const cs = chapters.filter((c) => c.subjectId === del.id)
    const n = topics.filter((t) => cs.some((c) => c.id === t.chapterId)).length
    const name = subjects.find((s) => s.id === del.id)?.name ?? ''
    delTitle = `Delete subject “${name}”?`
    delBody =
      `This permanently deletes the subject, its ${cs.length} chapter(s), ${n} topic(s), ` +
      'its activity list and every activity record on it.'
  } else if (del?.what === 'chapter') {
    const n = topics.filter((t) => t.chapterId === del.id).length
    const name = chapters.find((c) => c.id === del.id)?.name ?? ''
    delTitle = `Delete chapter “${name}”?`
    delBody = `This permanently deletes the chapter, its ${n} topic(s) and all its activity records.`
  } else if (del?.what === 'topic') {
    const name = topics.find((t) => t.id === del.id)?.name ?? ''
    delTitle = `Delete topic “${name}”?`
    delBody = 'This permanently deletes the topic and its progress.'
  }

  async function confirmDelete() {
    if (!del) return
    setBusy(true)
    await act(async () => {
      if (del.what === 'subject') {
        await deleteSubject(pid, del.id)
        if (selected === del.id) setSelected(null)
      } else if (del.what === 'chapter') {
        await deleteChapter(pid, del.id)
      } else {
        await deleteTopic(pid, del.id)
      }
      close()
    })
    setBusy(false)
  }

  const sharedModals = (
    <>
      <Modal open={dlg?.kind === 'subject-new'} title="New subject" onClose={close}>
        <SubjectForm
          initial={{ name: '', color: SUBJECT_COLORS[0] }}
          submitLabel="Add subject"
          onCancel={close}
          onSave={async (d) => {
            const id = await createSubject(pid, d)
            selectSubject(id)
            close()
          }}
        />
      </Modal>
      <Modal open={actDlg !== null} title={actTitle} onClose={close}>
        {actDlg && (
          <ActivityTypesEditor
            profileId={pid}
            scope={actDlg.scope}
            types={actTypes}
            recordCounts={recordCounts}
            copySources={copySources}
            onClose={close}
          />
        )}
      </Modal>
    </>
  )

  if (subjects.length === 0 || !subject) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold">Syllabus</h1>
        <p className={`mb-4 mt-3 ${MUTED_CLS}`}>
          Start by adding a subject, then its chapters and topics. StudyOS does not ship a
          ready-made syllabus: you enter your real one. Each subject also gets a list of
          activities to tick per chapter (theory, practice, revision…). Every one is optional
          and editable.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={primaryBtn} onClick={() => setDlg({ kind: 'subject-new' })}>
            Add your first subject
          </button>
          <button
            className={secondaryBtn}
            onClick={() => setDlg({ kind: 'activities', scope: null })}
          >
            Choose the default activities first
          </button>
        </div>
        {sharedModals}
      </div>
    )
  }

  const subjIndex = subjects.findIndex((s) => s.id === subject.id)

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Syllabus</h1>
      {error && (
        <p role="alert" className={ALERT_CLS}>
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Subjects">
        {ordered.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === subject.id}
            onClick={() => selectSubject(s.id)}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${
              s.id === subject.id ? PRESSED_CLS : UNPRESSED_CLS
            }`}
          >
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
            {s.pinned && <Pin size={12} aria-label="pinned" />}
          </button>
        ))}
        <button
          type="button"
          className={`${secondaryBtn} gap-1`}
          onClick={() => setDlg({ kind: 'subject-new' })}
        >
          <Plus size={16} aria-hidden /> Subject
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <h2 className="mr-auto text-xl font-semibold">{subject.name}</h2>
        <IconBtn
          label={subject.pinned ? 'Unpin subject' : 'Pin subject'}
          pressed={subject.pinned === true}
          onClick={() => void act(() => setSubjectPinned(pid, subject.id, !subject.pinned))}
        >
          <Pin size={18} aria-hidden />
        </IconBtn>
        <IconBtn
          label="Move subject earlier"
          disabled={subjIndex === 0}
          onClick={() => void act(() => moveItem(pid, 'subject', subject.id, -1))}
        >
          <ArrowUp size={18} aria-hidden />
        </IconBtn>
        <IconBtn
          label="Move subject later"
          disabled={subjIndex === subjects.length - 1}
          onClick={() => void act(() => moveItem(pid, 'subject', subject.id, 1))}
        >
          <ArrowDown size={18} aria-hidden />
        </IconBtn>
        <IconBtn
          label="Edit subject"
          onClick={() => setDlg({ kind: 'subject-edit', id: subject.id })}
        >
          <Pencil size={18} aria-hidden />
        </IconBtn>
        <IconBtn
          label="Delete subject"
          onClick={() => setDlg({ kind: 'delete', what: 'subject', id: subject.id })}
        >
          <Trash2 size={18} aria-hidden />
        </IconBtn>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm font-medium">
          Search chapters
          <input
            type="search"
            className={fieldCls}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this subject"
          />
        </label>
        <label className="text-sm font-medium">
          Show
          <select
            className={fieldCls}
            value={prefs.filter}
            onChange={(e) => savePrefs({ filter: e.target.value as ChapterFilter })}
          >
            {CHAPTER_FILTERS.map((f) => (
              <option key={f} value={f}>
                {FILTER_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
        <span className="flex gap-1" role="group" aria-label="Layout">
          {TRACKER_VIEWS.map((v: TrackerView) => (
            <button
              key={v}
              type="button"
              aria-pressed={prefs.view === v}
              onClick={() => savePrefs({ view: v })}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium capitalize ${
                prefs.view === v ? PRESSED_CLS : UNPRESSED_CLS
              }`}
            >
              {v}
            </button>
          ))}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Chapters{' '}
          <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
            {visible.length === subjectChapters.length
              ? subjectChapters.length
              : `${visible.length} of ${subjectChapters.length}`}
          </span>
        </h3>
        <button
          className={`${primaryBtn} inline-flex items-center gap-1`}
          onClick={() => setDlg({ kind: 'chapter-new' })}
        >
          <Plus size={16} aria-hidden /> Chapter
        </button>
      </div>

      {subjectChapters.length === 0 && <p className={MUTED_CLS}>No chapters yet. Add the first one.</p>}
      {subjectChapters.length > 0 && visible.length === 0 && (
        <p className={MUTED_CLS}>
          No chapters match.{' '}
          <button
            className="underline"
            onClick={() => {
              setQuery('')
              savePrefs({ filter: 'all' })
            }}
          >
            Clear search and filter
          </button>
        </p>
      )}

      {visible.map((ch) => {
        const ci = subjectChapters.findIndex((c) => c.id === ch.id)
        return (
          <ChapterTracker
            key={`${prefs.view}-${ch.id}`}
            chapter={ch}
            number={ci + 1}
            types={subjectTypes}
            records={records.filter((r) => r.chapterId === ch.id)}
            detailed={prefs.view === 'detailed'}
            pending={pendingKeys}
            onSet={(typeId, to) => void tick(ch.id, typeId, to)}
            onTogglePin={() => void act(() => setChapterPinned(pid, ch.id, !ch.pinned))}
          >
            <ChapterBody
              chapter={ch}
              index={ci}
              count={subjectChapters.length}
              topics={topics.filter((t) => t.chapterId === ch.id)}
              onAddTopic={() => setDlg({ kind: 'topic-new', chapterId: ch.id })}
              onBulk={() => setDlg({ kind: 'bulk', chapterId: ch.id })}
              onEdit={() => setDlg({ kind: 'chapter-edit', id: ch.id })}
              onDelete={() => setDlg({ kind: 'delete', what: 'chapter', id: ch.id })}
              onMove={(dir) => void act(() => moveItem(pid, 'chapter', ch.id, dir))}
              onTopicStatus={(id, s) => void act(() => setTopicStatus(pid, id, s))}
              onTopicEdit={(id) => setDlg({ kind: 'topic-edit', id })}
              onTopicDelete={(id) => setDlg({ kind: 'delete', what: 'topic', id })}
              onTopicMove={(id, dir) => void act(() => moveItem(pid, 'topic', id, dir))}
            />
          </ChapterTracker>
        )
      })}

      <ActivityProgress
        slots={subjectSlots}
        types={subjectTypes}
        chapterIds={subjectChapters.map((c) => c.id)}
        overall={allSlots}
      />
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
          Topic content progress
        </summary>
        <ProgressPanel
          chapters={subjectChapters}
          topics={subjectTopics}
          basis={basis}
          onBasis={setBasis}
        />
      </details>

      <details className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
          Tracker preferences
        </summary>
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap gap-2">
            <button
              className={secondaryBtn}
              onClick={() => setDlg({ kind: 'activities', scope: subject.id })}
            >
              Customise activities for {subject.name}
            </button>
            <button
              className={secondaryBtn}
              onClick={() => setDlg({ kind: 'activities', scope: null })}
            >
              Default set for new subjects
            </button>
          </div>
          <label className="block text-sm font-medium">
            Open the tracker on
            <select
              className={fieldCls}
              value={prefs.defaultSubjectId ?? ''}
              onChange={(e) =>
                savePrefs({ defaultSubjectId: e.target.value === '' ? null : e.target.value })
              }
            >
              <option value="">The subject I used last</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Layout, filter and last subject are remembered automatically.
          </p>
          <button
            className={secondaryBtn}
            onClick=
