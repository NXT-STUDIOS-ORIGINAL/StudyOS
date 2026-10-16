import { useState } from 'react'
import type { SyllabusData } from '../../hooks/useSyllabus'
import {
  deleteChapter,
  deleteSubject,
  deleteTopic,
  type SyllabusKind,
} from '../../lib/syllabusRepo'
import { ConfirmDialog } from '../ConfirmDialog'

interface Target { what: SyllabusKind; id: string }

interface Props {
  target: Target | null
  data: SyllabusData
  profileId: string
  onClose: () => void
  onDeleted: (what: SyllabusKind, id: string) => void
}

function describe(t: Target, d: SyllabusData): { title: string; body: string } {
  if (t.what === 'subject') {
    const chapters = d.chapters.filter((c) => c.subjectId === t.id)
    const n = d.topics.filter((x) => chapters.some((c) => c.id === x.chapterId)).length
    const name = d.subjects.find((s) => s.id === t.id)?.name ?? ''
    return {
      title: `Delete subject “${name}”?`,
      body:
        `This permanently deletes the subject, its ${chapters.length} chapter(s), ${n} topic(s), ` +
        'its activity list and every activity record on it.',
    }
  }
  if (t.what === 'chapter') {
    const n = d.topics.filter((x) => x.chapterId === t.id).length
    const name = d.chapters.find((c) => c.id === t.id)?.name ?? ''
    return {
      title: `Delete chapter “${name}”?`,
      body: `This permanently deletes the chapter, its ${n} topic(s) and all its activity records.`,
    }
  }
  const name = d.topics.find((x) => x.id === t.id)?.name ?? ''
  return {
    title: `Delete topic “${name}”?`,
    body: 'This permanently deletes the topic and its progress.',
  }
}

export function DeleteSyllabusDialog({ target, data, profileId, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const text = target ? describe(target, data) : { title: '', body: '' }

  function cancel() {
    setError(null)
    onClose()
  }

  async function confirm() {
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      if (target.what === 'subject') await deleteSubject(profileId, target.id)
      else if (target.what === 'chapter') await deleteChapter(profileId, target.id)
      else await deleteTopic(profileId, target.id)
      onDeleted(target.what, target.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={target !== null}
      title={text.title}
      confirmLabel="Delete permanently"
      danger
      busy={busy}
      error={error}
      onCancel={cancel}
      onConfirm={confirm}
    >
      <p>{text.body}</p>
      <p>This cannot be undone. Download a backup first if unsure.</p>
    </ConfirmDialog>
  )
}
