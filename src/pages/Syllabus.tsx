import { useState } from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import type { Profile } from '../domain/types'
import type { WeightBasis } from '../domain/syllabus/progress'
import { buildSlots, dedupeRecords } from '../domain/activity/progress'
import { filterChapters } from '../domain/tracker/tracker'
import { useSyllabus } from '../hooks/useSyllabus'
import { useTrackerPrefs } from '../hooks/useTrackerPrefs'
import { errMsg, useTick } from '../hooks/useTick'
import { moveItem, setTopicStatus } from '../lib/syllabusRepo'
import {
  resetTrackerPrefs,
  saveTrackerPrefs,
  setChapterPinned,
  setSubjectPinned,
  type TrackerPrefsPatch,
} from '../lib/trackerRepo'
import { Toast } from '../components/Toast'
import { ActivityProgress } from '../components/activity/ActivityProgress'
import { ChapterTracker } from '../components/activity/ChapterTracker'
import { ChapterBody } from '../components/syllabus/ChapterBody'
import { DeleteSyllabusDialog } from '../components/syllabus/DeleteSyllabusDialog'
import { ProgressPanel } from '../components/syllabus/ProgressPanel'
import { SubjectHeader } from '../components/syllabus/SubjectHeader'
import { SyllabusDialogs, type Dlg } from '../components/syllabus/SyllabusDialogs'
import { TrackerPreferences } from '../components/syllabus/TrackerPreferences'
import { TrackerToolbar } from '../components/syllabus/TrackerToolbar'
import { primaryBtn, secondaryBtn } from '../components/ui'

const ALERT_CLS =
  'rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 ' +
  'dark:border-red-800 dark:bg-red-950 dark:text-red-200'
const MUTED_CLS = 'text-sm text-slate-600 dark:text-slate-400'

export function SyllabusPage({ profile }: { profile: Profile }) {
  const pid = profile.id
  const data = useSyllabus(pid)
  const prefs = useTrackerPrefs(pid)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [basis, setBasis] = useState<WeightBasis>('weight')
  const [dlg, setDlg] = useState<Dlg>(null)
  const [error, setError] = useState<string | null>(null)

  const { pendingKeys, toast, closeToast, tick } = useTick(pid, (chapterId, typeId) => ({
    name: data?.activityTypes.find((t) => t.id === typeId)?.name ?? 'Activity',
    where: data?.chapters.find((c) => c.id === chapterId)?.name ?? '',
  }))

  if (!data || !prefs) return <p role="status">Loading…</p>

  const { subjects, chapters, topics, activityTypes } = data
  const records = dedupeRecords(data.activityRecords)
  const close = () => setDlg(null)

  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(errMsg(e))
    }
  }
  const savePrefs = (patch: TrackerPrefsPatch) => void act(() => saveTrackerPrefs(pid, patch))

  const ordered = [...subjects].sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true))
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

  const dialogs = (
    <>
      <SyllabusDialogs
        dlg={dlg}
        onClose={close}
        data={data}
        profileId={pid}
        subject={subject}
        onSubjectCreated={selectSubject}
      />
      <DeleteSyllabusDialog
        target={dlg?.kind === 'delete' ? { what: dlg.what, id: dlg.id } : null}
        data={data}
        profileId={pid}
        onClose={close}
        onDeleted={(what, id) => {
          if (what === 'subject' && selected === id) setSelected(null)
          close()
        }}
      />
    </>
  )

  if (!subject) {
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
          <button className={secondaryBtn} onClick={() => setDlg({ kind: 'activities', scope: null })}>
            Choose the default activities first
          </button>
        </div>
        {dialogs}
      </div>
    )
  }

  const subjectChapters = chapters.filter((c) => c.subjectId === subject.id)
  const subjectTopics = topics.filter((t) => subjectChapters.some((c) => c.id === t.chapterId))
  const subjectTypes = activityTypes.filter((t) => t.subjectId === subject.id)
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
  const subjIndex = subjects.findIndex((s) => s.id === subject.id)

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold">Syllabus</h1>
      {error && (
        <p role="alert" className={ALERT_CLS}>
          {error}
        </p>
      )}

      <SubjectHeader
        subjects={ordered}
        subject={subject}
        canMoveEarlier={subjIndex > 0}
        canMoveLater={subjIndex < subjects.length - 1}
        onSelect={selectSubject}
        onNew={() => setDlg({ kind: 'subject-new' })}
        onPin={() => void act(() => setSubjectPinned(pid, subject.id, !subject.pinned))}
        onMove={(dir) => void act(() => moveItem(pid, 'subject', subject.id, dir))}
        onEdit={() => setDlg({ kind: 'subject-edit', id: subject.id })}
        onDelete={() => setDlg({ kind: 'delete', what: 'subject', id: subject.id })}
      />

      <TrackerToolbar
        query={query}
        onQuery={setQuery}
        filter={prefs.filter}
        onFilter={(filter) => savePrefs({ filter })}
        view={prefs.view}
        onView={(view) => savePrefs({ view })}
      />

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

      <TrackerPreferences
        subjects={subjects}
        subjectId={subject.id}
        subjectName={subject.name}
        defaultSubjectId={prefs.defaultSubjectId}
        onDefault={(id) => savePrefs({ defaultSubjectId: id })}
        onCustomise={(scope) => setDlg({ kind: 'activities', scope })}
        onReset={() =>
          void act(async () => {
            await resetTrackerPrefs(pid)
            setSelected(null)
            setQuery('')
          })
        }
      />

      {dialogs}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}
