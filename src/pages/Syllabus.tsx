import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Profile } from '../domain/types'
import { STATUS_LABELS, SUBJECT_COLORS, TOPIC_STATUSES, type TopicStatus } from '../domain/syllabus/types'
import { emptyChapterDraft, emptyTopicDraft } from '../domain/syllabus/rules'
import type { WeightBasis } from '../domain/syllabus/progress'
import { buildSlots, dedupeRecords } from '../domain/activity/progress'
import type { ActivityStatus } from '../domain/activity/types'
import { useSyllabus } from '../hooks/useSyllabus'
import {
  bulkAddTopics, createChapter, createSubject, createTopic, deleteChapter, deleteSubject, deleteTopic,
  moveItem, setTopicStatus, updateChapter, updateSubject, updateTopic, type SyllabusKind,
} from '../lib/syllabusRepo'
import { setActivityStatus } from '../lib/activityRepo'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ActivityProgress } from '../components/activity/ActivityProgress'
import { ActivityTypesEditor } from '../components/activity/ActivityTypesEditor'
import { ChapterTracker } from '../components/activity/ChapterTracker'
import { ProgressPanel } from '../components/syllabus/ProgressPanel'
import { BulkTopicsForm, ChapterForm, SubjectForm, TopicForm } from '../components/syllabus/SyllabusEditors'
import { primaryBtn, secondaryBtn } from '../components/ui'

type Dlg =
  | { kind: 'subject-new' } | { kind: 'subject-edit'; id: string }
  | { kind: 'chapter-new' } | { kind: 'chapter-edit'; id: string }
  | { kind: 'topic-new'; chapterId: string } | { kind: 'topic-edit'; id: string }
  | { kind: 'bulk'; chapterId: string }
  | { kind: 'activities'; scope: string | null }
  | { kind: 'delete'; what: SyllabusKind; id: string }
  | null

interface Pending { chapterId: string; typeId: string; to: ActivityStatus }

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">
      {children}
    </button>
  )
}

export function SyllabusPage({ profile }: { profile: Profile }) {
  const data = useSyllabus(profile.id)
  const [selected, setSelected] = useState<string | null>(null)
  const [basis, setBasis] = useState<WeightBasis>('weight')
  const [view, setView] = useState<'compact' | 'detailed'>('compact')
  const [dlg, setDlg] = useState<Dlg>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!data) return <p role="status">Loading…</p>
  const { subjects, chapters, topics, activityTypes } = data
  const records = dedupeRecords(data.activityRecords)
  const pid = profile.id
  const close = () => setDlg(null)
  async function act(fn: () => Promise<unknown>) {
    setError(null)
    try { await fn() } catch (e) { setError(e instanceof Error ? e.message : 'That did not work.') }
  }

  const subject = subjects.find((s) => s.id === selected) ?? subjects[0]
  const subjectChapters = subject ? chapters.filter((c) => c.subjectId === subject.id) : []
  const subjectTopics = topics.filter((t) => subjectChapters.some((c) => c.id === t.chapterId))
  const subjectTypes = subject ? activityTypes.filter((t) => t.subjectId === subject.id) : []
  const subjectSlots = buildSlots(subjectTypes, subjectChapters, records)
  const allSlots = buildSlots(activityTypes, chapters, records)

  function setStatus(chapterId: string, typeId: string, to: ActivityStatus, current: ActivityStatus) {
    if (current === 'done' && to !== 'done') { setPending({ chapterId, typeId, to }); return }
    void act(() => setActivityStatus(pid, chapterId, typeId, to))
  }

  const editSubject = dlg?.kind === 'subject-edit' ? subjects.find((s) => s.id === dlg.id) : undefined
  const editChapter = dlg?.kind === 'chapter-edit' ? chapters.find((c) => c.id === dlg.id) : undefined
  const editTopic = dlg?.kind === 'topic-edit' ? topics.find((t) => t.id === dlg.id) : undefined
  const newTopicIn = dlg?.kind === 'topic-new' ? chapters.find((c) => c.id === dlg.chapterId) : undefined
  const bulkIn = dlg?.kind === 'bulk' ? chapters.find((c) => c.id === dlg.chapterId) : undefined
  const actDlg = dlg?.kind === 'activities' ? dlg : null
  const actTypes = actDlg ? activityTypes.filter((t) => t.subjectId === actDlg.scope) : []
  const actTitle = !actDlg ? '' : actDlg.scope === null ? 'Default activities for new subjects'
    : `Activities for ${subjects.find((s) => s.id === actDlg.scope)?.name ?? ''}`
  const copySources = !actDlg ? [] : [
    ...(actDlg.scope === null ? [] : [{ id: null as string | null, label: 'Default set' }]),
    ...subjects.filter((s) => s.id !== actDlg.scope).map((s) => ({ id: s.id as string | null, label: s.name })),
  ]
  const recordCounts = new Map<string, number>()
  for (const r of records) recordCounts.set(r.activityTypeId, (recordCounts.get(r.activityTypeId) ?? 0) + 1)

  const pend = pending
  const pendType = pend ? activityTypes.find((t) => t.id === pend.typeId) : undefined
  const pendChapter = pend ? chapters.find((c) => c.id === pend.chapterId) : undefined

  const del = dlg?.kind === 'delete' ? dlg : null
  let delTitle = ''
  let delBody = ''
  if (del?.what === 'subject') {
    const cs = chapters.filter((c) => c.subjectId === del.id)
    const n = topics.filter((t) => cs.some((c) => c.id === t.chapterId)).length
    delTitle = `Delete subject “${subjects.find((s) => s.id === del.id)?.name ?? ''}”?`
    delBody = `This permanently deletes the subject, its ${cs.length} chapter(s), ${n} topic(s), its activity list and every activity record on it.`
  } else if (del?.what === 'chapter') {
    const n = topics.filter((t) => t.chapterId === del.id).length
    delTitle = `Delete chapter “${chapters.find((c) => c.id === del.id)?.name ?? ''}”?`
    delBody = `This permanently deletes the chapter, its ${n} topic(s) and all its activity records.`
  } else if (del?.what === 'topic') {
    delTitle = `Delete topic “${topics.find((t) => t.id === del.id)?.name ?? ''}”?`
    delBody = 'This permanently deletes the topic and its progress.'
  }

  async function confirmDelete() {
    if (!del) return
    setBusy(true)
    await act(async () => {
      if (del.what === 'subject') { await deleteSubject(pid, del.id); if (selected === del.id) setSelected(null) }
      else if (del.what === 'chapter') await deleteChapter(pid, del.id)
      else await deleteTopic(pid, del.id)
      close()
    })
    setBusy(false)
  }

  async function confirmPending() {
    if (!pend) return
    setBusy(true)
    await act(() => setActivityStatus(pid, pend.chapterId, pend.typeId, pend.to))
    setBusy(false)
    setPending(null)
  }

  const subjectModals = (
    <>
      <Modal open={dlg?.kind === 'subject-new'} title="New subject" onClose={close}>
        <SubjectForm initial={{ name: '', color: SUBJECT_COLORS[0] }} submitLabel="Add subject" onCancel={close}
          onSave={async (d) => { setSelected(await createSubject(pid, d)); close() }} />
      </Modal>
      <Modal open={actDlg !== null} title={actTitle} onClose={close}>
        {actDlg && <ActivityTypesEditor profileId={pid} scope={actDlg.scope} types={actTypes}
          recordCounts={recordCounts} copySources={copySources} onClose={close} />}
      </Modal>
    </>
  )

  if (subjects.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold">Syllabus</h1>
        <p className="mb-4 mt-3 text-slate-600 dark:text-slate-400">
          Start by adding a subject, then its chapters and topics. StudyOS does not ship a ready-made
          syllabus: you enter your real one. Each subject also gets a list of activities to tick per chapter
          (theory, practice, revision…). Every one is optional and editable.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={primaryBtn} onClick={() => setDlg({ kind: 'subject-new' })}>Add your first subject</button>
          <button className={secondaryBtn} onClick={() => setDlg({ kind: 'activities', scope: null })}>Choose the default activities first</button>
        </div>
        {subjectModals}
      </div>
    )
  }

  const subjIndex = subjects.findIndex((s) => s.id === subject.id)

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold">Syllabus</h1>
      {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Subjects">
        {subjects.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === subject.id} onClick={() => setSelected(s.id)}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${s.id === subject.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-300 dark:border-slate-700'}`}>
            <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
          </button>
        ))}
        <button type="button" className={`${secondaryBtn} gap-1`} onClick={() => setDlg({ kind: 'subject-new' })}>
          <Plus size={16} aria-hidden /> Subject
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <h2 className="mr-auto text-xl font-semibold">{subject.name}</h2>
        <IconBtn label="Move subject earlier" disabled={subjIndex === 0} onClick={() => void act(() => moveItem(pid, 'subject', subject.id, -1))}><ArrowUp size={18} aria-hidden /></IconBtn>
        <IconBtn label="Move subject later" disabled={subjIndex === subjects.length - 1} onClick={() => void act(() => moveItem(pid, 'subject', subject.id, 1))}><ArrowDown size={18} aria-hidden /></IconBtn>
        <IconBtn label="Edit subject" onClick={() => setDlg({ kind: 'subject-edit', id: subject.id })}><Pencil size={18} aria-hidden /></IconBtn>
        <IconBtn label="Delete subject" onClick={() => setDlg({ kind: 'delete', what: 'subject', id: subject.id })}><Trash2 size={18} aria-hidden /></IconBtn>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className={secondaryBtn} onClick={() => setDlg({ kind: 'activities', scope: subject.id })}>Customise activities</button>
        <button className={secondaryBtn} onClick={() => setDlg({ kind: 'activities', scope: null })}>Default set for new subjects</button>
        <span className="ml-auto flex gap-1" role="group" aria-label="View">
          {(['compact', 'detailed'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={`min-h-11 rounded-lg border px-3 text-sm font-medium capitalize ${view === v ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-300 dark:border-slate-700'}`}>{v}</button>
          ))}
        </span>
      </div>

      <ActivityProgress slots={subjectSlots} types={subjectTypes} chapterIds={subjectChapters.map((c) => c.id)} overall={allSlots} />
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Topic content progress</summary>
        <ProgressPanel chapters={subjectChapters} topics={subjectTopics} basis={basis} onBasis={setBasis} />
      </details>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chapters</h3>
        <button className={`${primaryBtn} inline-flex items-center gap-1`} onClick={() => setDlg({ kind: 'chapter-new' })}>
          <Plus size={16} aria-hidden /> Chapter
        </button>
      </div>
      {subjectChapters.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">No chapters yet. Add the first one.</p>}

      {subjectChapters.map((ch, ci) => {
        const ts = topics.filter((t) => t.chapterId === ch.id)
        return (
          <ChapterTracker key={`${view}-${ch.id}`} chapter={ch} number={ci + 1} types={subjectTypes}
            records={records.filter((r) => r.chapterId === ch.id)} detailed={view === 'detailed'} onSet={(typeId, to, current) => setStatus(ch.id, typeId, to, current)}>
            <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button className={secondaryBtn} onClick={() => setDlg({ kind: 'topic-new', chapterId: ch.id })}>Add topic</button>
              <button className={secondaryBtn} onClick={() => setDlg({ kind: 'bulk', chapterId: ch.id })}>Add many</button>
              <span className="ml-auto flex">
                <IconBtn label={`Move ${ch.name} earlier`} disabled={ci === 0} onClick={() => void act(() => moveItem(pid, 'chapter', ch.id, -1))}><ArrowUp size={18} aria-hidden /></IconBtn>
                <IconBtn label={`Move ${ch.name} later`} disabled={ci === subjectChapters.length - 1} onClick={() => void act(() => moveItem(pid, 'chapter', ch.id, 1))}><ArrowDown size={18} aria-hidden /></IconBtn>
                <IconBtn label={`Edit chapter ${ch.name}`} onClick={() => setDlg({ kind: 'chapter-edit', id: ch.id })}><Pencil size={18} aria-hidden /></IconBtn>
                <IconBtn label={`Delete chapter ${ch.name}`} onClick={() => setDlg({ kind: 'delete', what: 'chapter', id: ch.id })}><Trash2 size={18} aria-hidden /></IconBtn>
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
                      onChange={(e) => void act(() => setTopicStatus(pid, t.id, e.target.value as TopicStatus))}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                      {TOPIC_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <IconBtn label={`Move ${t.name} earlier`} disabled={ti === 0} onClick={() => void act(() => moveItem(pid, 'topic', t.id, -1))}><ArrowUp size={18} aria-hidden /></IconBtn>
                    <IconBtn label={`Move ${t.name} later`} disabled={ti === ts.length - 1} onClick={() => void act(() => moveItem(pid, 'topic', t.id, 1))}><ArrowDown size={18} aria-hidden /></IconBtn>
                    <IconBtn label={`Edit topic ${t.name}`} onClick={() => setDlg({ kind: 'topic-edit', id: t.id })}><Pencil size={18} aria-hidden /></IconBtn>
                    <IconBtn label={`Delete topic ${t.name}`} onClick={() => setDlg({ kind: 'delete', what: 'topic', id: t.id })}><Trash2 size={18} aria-hidden /></IconBtn>
                  </li>
                ))}
              </ul>
            )}
          </ChapterTracker>
        )
      })}

      {subjectModals}
      <Modal open={!!editSubject} title="Edit subject" onClose={close}>
        {editSubject && <SubjectForm initial={{ name: editSubject.name, color: editSubject.color }} submitLabel="Save" onCancel={close}
          onSave={async (d) => { await updateSubject(pid, editSubject.id, d); close() }} />}
      </Modal>
      <Modal open={dlg?.kind === 'chapter-new'} title="New chapter" onClose={close}>
        <ChapterForm initial={emptyChapterDraft()} submitLabel="Add chapter" onCancel={close}
          onSave={async (d) => { await createChapter(pid, subject.id, d); close() }} />
      </Modal>
      <Modal open={!!editChapter} title="Edit chapter" onClose={close}>
        {editChapter && <ChapterForm initial={{ name: editChapter.name, weight: editChapter.weight, estimatedMinutes: editChapter.estimatedMinutes, targetDate: editChapter.targetDate, notes: editChapter.notes }}
          submitLabel="Save" onCancel={close} onSave={async (d) => { await updateChapter(pid, editChapter.id, d); close() }} />}
      </Modal>
      <Modal open={!!newTopicIn} title={`New topic in ${newTopicIn?.name ?? ''}`} onClose={close}>
        {newTopicIn && <TopicForm initial={emptyTopicDraft()} submitLabel="Add topic" onCancel={close}
          onSave={async (d) => { await createTopic(pid, newTopicIn.id, d); close() }} />}
      </Modal>
      <Modal open={!!editTopic} title="Edit topic" onClose={close}>
        {editTopic && <TopicForm initial={{ name: editTopic.name, status: editTopic.status, contentPercent: editTopic.contentPercent, practised: editTopic.practised, revised: editTopic.revised, difficulty: editTopic.difficulty, importance: editTopic.importance, estimatedMinutes: editTopic.estimatedMinutes, notes: editTopic.notes }}
          submitLabel="Save" onCancel={close} onSave={async (d) => { await updateTopic(pid, editTopic.id, d); close() }} />}
      </Modal>
      <Modal open={!!bulkIn} title={`Add many topics to ${bulkIn?.name ?? ''}`} onClose={close}>
        {bulkIn && <BulkTopicsForm onClose={close} onSave={(text) => bulkAddTopics(pid, bulkIn.id, text)} />}
      </Modal>

      <ConfirmDialog open={del !== null} title={delTitle} confirmLabel="Delete permanently" danger busy={busy}
        onCancel={close} onConfirm={confirmDelete}>
        <p>{delBody}</p>
        <p>This cannot be undone. Download a backup first if unsure.</p>
      </ConfirmDialog>

      <ConfirmDialog open={pend !== null}
        title={pend?.to === 'na' ? 'Mark as not applicable?' : 'Mark as not done?'}
        confirmLabel={pend?.to === 'na' ? 'Mark not applicable' : 'Mark not done'} danger busy={busy}
        onCancel={() => setPending(null)} onConfirm={confirmPending}>
        <p>“{pendType?.name}” for “{pendChapter?.name}” is currently done. Its completion date will be cleared
          and the activity will no longer count in progress.</p>
        <p>The change is kept in the activity’s history. No other activity is affected.</p>
      </ConfirmDialog>
    </div>
  )
      }
