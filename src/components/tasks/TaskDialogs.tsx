import { useState } from 'react'
import type { Chapter, Subject } from '../../domain/syllabus/types'
import { emptyTaskDraft } from '../../domain/tasks/rules'
import type { Task } from '../../domain/tasks/types'
import { createTask, deleteTask, rescheduleTasks, updateTask } from '../../lib/taskRepo'
import { ConfirmDialog } from '../ConfirmDialog'
import { Modal } from '../Modal'
import { TaskForm } from './TaskForm'

export type TaskDlg =
  | { kind: 'new' }
  | { kind: 'edit'; id: string }
  | { kind: 'delete'; id: string }
  | { kind: 'reschedule' }
  | null

interface Props {
  dlg: TaskDlg
  onClose: () => void
  profileId: string
  tasks: Task[]
  subjects: Subject[]
  chapters: Chapter[]
  today: string
  overdueIds: string[]
  defaultSubjectId: string | null
}

export function TaskDialogs(p: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editId = p.dlg?.kind === 'edit' ? p.dlg.id : null
  const delId = p.dlg?.kind === 'delete' ? p.dlg.id : null
  const edit = editId === null ? undefined : p.tasks.find((t) => t.id === editId)
  const del = delId === null ? undefined : p.tasks.find((t) => t.id === delId)

  function close() {
    setError(null)
    p.onClose()
  }

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      p.onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal open={p.dlg?.kind === 'new'} title="New task" onClose={close}>
        <TaskForm
          initial={{ ...emptyTaskDraft(), subjectId: p.defaultSubjectId, dueDate: p.today }}
          subjects={p.subjects}
          chapters={p.chapters}
          submitLabel="Add task"
          onCancel={close}
          onSave={async (d) => {
            await createTask(p.profileId, d)
            p.onClose()
          }}
        />
      </Modal>

      <Modal open={!!edit} title="Edit task" onClose={close}>
        {edit && (
          <TaskForm
            initial={{
              title: edit.title,
              notes: edit.notes,
              priority: edit.priority,
              subjectId: edit.subjectId,
              chapterId: edit.chapterId,
              plannedMinutes: edit.plannedMinutes,
              actualMinutes: edit.actualMinutes,
              startDate: edit.startDate,
              dueDate: edit.dueDate,
            }}
            subjects={p.subjects}
            chapters={p.chapters}
            submitLabel="Save"
            onCancel={close}
            onSave={async (d) => {
              await updateTask(p.profileId, edit.id, d)
              p.onClose()
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!del}
        title={`Delete “${del?.title ?? ''}”?`}
        confirmLabel="Delete task"
        danger
        busy={busy}
        error={error}
        onCancel={close}
        onConfirm={() => del && void run(() => deleteTask(p.profileId, del.id))}
      >
        <p>This permanently deletes the task. Your syllabus and progress are not affected.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={p.dlg?.kind === 'reschedule'}
        title="Move overdue tasks to today?"
        confirmLabel="Move to today"
        busy={busy}
        error={error}
        onCancel={close}
        onConfirm={() => void run(() => rescheduleTasks(p.profileId, p.overdueIds, p.today))}
      >
        <p>
          {p.overdueIds.length} unfinished task(s) will get today as their new due date. Nothing is deleted
          or marked done.
        </p>
      </ConfirmDialog>
    </>
  )
}
