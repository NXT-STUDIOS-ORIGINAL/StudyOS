import { useCallback, useRef, useState } from 'react'
import type { Task } from '../domain/tasks/types'
import { setTaskDone, undoTaskChange, type TaskChange } from '../lib/taskRepo'
import { errMsg } from './useTick'
import type { ToastData } from '../components/Toast'

let seq = 0

/** One-tap completion with undo. Ignores repeat taps while a save is in flight. */
export function useTaskToggle(profileId: string) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [toast, setToast] = useState<ToastData | null>(null)
  const inFlight = useRef(new Set<string>())
  const closeToast = useCallback(() => setToast(null), [])
  const show = (t: Omit<ToastData, 'id'>) => setToast({ ...t, id: ++seq })

  async function undo(change: TaskChange) {
    try {
      const ok = await undoTaskChange(profileId, change)
      show(ok ? { message: 'Undone' } : { message: 'Could not undo: it was changed again since.', tone: 'error' })
    } catch (e) {
      show({ message: `Undo failed: ${errMsg(e)}`, tone: 'error' })
    }
  }

  async function toggle(task: Task, done: boolean) {
    if (inFlight.current.has(task.id)) return
    inFlight.current.add(task.id)
    setPending(new Set(inFlight.current))
    try {
      const change = await setTaskDone(profileId, task.id, done)
      if (change) {
        show({
          message: `“${task.title}” ${done ? 'done' : 'not done'}`,
          actionLabel: 'Undo',
          onAction: () => void undo(change),
        })
      }
    } catch (e) {
      show({ message: `Not saved: ${errMsg(e)}`, tone: 'error' })
    } finally {
      inFlight.current.delete(task.id)
      setPending(new Set(inFlight.current))
    }
  }

  return { pending, toast, closeToast, toggle }
}
