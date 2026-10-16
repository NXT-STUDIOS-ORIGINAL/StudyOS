import { SUBJECT_COLORS, type Subject } from '../../domain/syllabus/types'
import { emptyChapterDraft, emptyTopicDraft } from '../../domain/syllabus/rules'
import { dedupeRecords } from '../../domain/activity/progress'
import type { SyllabusData } from '../../hooks/useSyllabus'
import {
  bulkAddTopics,
  createChapter,
  createSubject,
  createTopic,
  updateChapter,
  updateSubject,
  updateTopic,
  type SyllabusKind,
} from '../../lib/syllabusRepo'
import { Modal } from '../Modal'
import { ActivityTypesEditor } from '../activity/ActivityTypesEditor'
import { BulkTopicsForm, ChapterForm, SubjectForm, TopicForm } from './SyllabusEditors'

export type Dlg =
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

interface Props {
  dlg: Dlg
  onClose: () => void
  data: SyllabusData
  profileId: string
  subject: Subject | undefined
  onSubjectCreated: (id: string) => void
}

export function SyllabusDialogs({ dlg, onClose, data, profileId, subject, onSubjectCreated }: Props) {
  const pid = profileId
  const { subjects, chapters, topics, activityTypes } = data

  const editSubject = dlg?.kind === 'subject-edit' ? subjects.find((s) => s.id === dlg.id) : undefined
  const editChapter = dlg?.kind === 'chapter-edit' ? chapters.find((c) => c.id === dlg.id) : undefined
  const editTopic = dlg?.kind === 'topic-edit' ? topics.find((t) => t.id === dlg.id) : undefined
  const newTopicIn = dlg?.kind === 'topic-new' ? chapters.find((c) => c.id === dlg.chapterId) : undefined
  const bulkIn = dlg?.kind === 'bulk' ? chapters.find((c) => c.id === dlg.chapterId) : undefined
  const actDlg = dlg?.kind === 'activities' ? dlg : null

  const actTypes = actDlg ? activityTypes.filter((t) => t.subjectId === actDlg.scope) : []
  let actTitle = ''
  const copySources: { id: string | null; label: string }[] = []
  if (actDlg) {
    const scopeName = subjects.find((s) => s.id === actDlg.scope)?.name ?? ''
    actTitle = actDlg.scope === null ? 'Default activities for new subjects' : `Activities for ${scopeName}`
    if (actDlg.scope !== null) copySources.push({ id: null, label: 'Default set' })
    for (const s of subjects) {
      if (s.id !== actDlg.scope) copySources.push({ id: s.id, label: s.name })
    }
  }

  const recordCounts = new Map<string, number>()
  for (const r of dedupeRecords(data.activityRecords)) {
    recordCounts.set(r.activityTypeId, (recordCounts.get(r.activityTypeId) ?? 0) + 1)
  }

  return (
    <>
      <Modal open={dlg?.kind === 'subject-new'} title="New subject" onClose={onClose}>
        <SubjectForm
          initial={{ name: '', color: SUBJECT_COLORS[0] }}
          submitLabel="Add subject"
          onCancel={onClose}
          onSave={async (d) => {
            const id = await createSubject(pid, d)
            onSubjectCreated(id)
            onClose()
          }}
        />
      </Modal>

      <Modal open={!!editSubject} title="Edit subject" onClose={onClose}>
        {editSubject && (
          <SubjectForm
            initial={{ name: editSubject.name, color: editSubject.color }}
            submitLabel="Save"
            onCancel={onClose}
            onSave={async (d) => {
              await updateSubject(pid, editSubject.id, d)
              onClose()
            }}
          />
        )}
      </Modal>

      <Modal open={dlg?.kind === 'chapter-new'} title="New chapter" onClose={onClose}>
        {subject && (
          <ChapterForm
            initial={emptyChapterDraft()}
            submitLabel="Add chapter"
            onCancel={onClose}
            onSave={async (d) => {
              await createChapter(pid, subject.id, d)
              onClose()
            }}
          />
        )}
      </Modal>

      <Modal open={!!editChapter} title="Edit chapter" onClose={onClose}>
        {editChapter && (
          <ChapterForm
            initial={{
              name: editChapter.name,
              weight: editChapter.weight,
              estimatedMinutes: editChapter.estimatedMinutes,
              targetDate: editChapter.targetDate,
              notes: editChapter.notes,
            }}
            submitLabel="Save"
            onCancel={onClose}
            onSave={async (d) => {
              await updateChapter(pid, editChapter.id, d)
              onClose()
            }}
          />
        )}
      </Modal>

      <Modal open={!!newTopicIn} title={`New topic in ${newTopicIn?.name ?? ''}`} onClose={onClose}>
        {newTopicIn && (
          <TopicForm
            initial={emptyTopicDraft()}
            submitLabel="Add topic"
            onCancel={onClose}
            onSave={async (d) => {
              await createTopic(pid, newTopicIn.id, d)
              onClose()
            }}
          />
        )}
      </Modal>

      <Modal open={!!editTopic} title="Edit topic" onClose={onClose}>
        {editTopic && (
          <TopicForm
            initial={{
              name: editTopic.name,
              status: editTopic.status,
              contentPercent: editTopic.contentPercent,
              practised: editTopic.practised,
              revised: editTopic.revised,
              difficulty: editTopic.difficulty,
              importance: editTopic.importance,
              estimatedMinutes: editTopic.estimatedMinutes,
              notes: editTopic.notes,
            }}
            submitLabel="Save"
            onCancel={onClose}
            onSave={async (d) => {
              await updateTopic(pid, editTopic.id, d)
              onClose()
            }}
          />
        )}
      </Modal>

      <Modal open={!!bulkIn} title={`Add many topics to ${bulkIn?.name ?? ''}`} onClose={onClose}>
        {bulkIn && (
          <BulkTopicsForm onClose={onClose} onSave={(text) => bulkAddTopics(pid, bulkIn.id, text)} />
        )}
      </Modal>

      <Modal open={actDlg !== null} title={actTitle} onClose={onClose}>
        {actDlg && (
          <ActivityTypesEditor
            profileId={pid}
            scope={actDlg.scope}
            types={actTypes}
            recordCounts={recordCounts}
            copySources={copySources}
            onClose={onClose}
          />
        )}
      </Modal>
    </>
  )
}
