import { useCallback, useRef, useState } from 'react'
import type { ActivityStatus } from '../domain/activity/types'
import { setActivityStatus, undoActivityChange, type ActivityChange } from '../lib/activityRepo'
import type { ToastData } from '../components/Toast'

let toastSeq = 0

export const errMsg = (e: unknown): string =>
  e instanceof Error ? e.message : 'That did not work.'

type Describe = (chapterId: string, typeId: string) => { name: string; where: string }

/** One-tap saving with undo. The screen follows the database, so success is never claimed early. */
export function useTick(profileId: string, describe: Describe) {
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(new Set())
  const [toast, setToast] = useState<ToastData | null>(null)
  const inFlight = useRef(new Set<string>())
  const closeToast = useCallback(() => setToast(null), [])
  const show = (t: Omit<ToastData, 'id'>) => setToast({ ...t, id: ++toastSeq })

  async function undo(change: ActivityChange) {
    try {
      const ok = await undoActivityChange(profileId, change)
      show(
        ok
          ? { message: 'Undone' }
          : { message: 'Could not undo: it was changed again since.', tone: 'error' },
      )
    } catch (e) {
      show({ message: `Undo failed: ${errMsg(e)}`, tone: 'error' })
    }
  }

  async function tick(chapterId: string, typeId: string, to: ActivityStatus) {
    const key = `${chapterId}|${typeId}`
    if (inFlight.current.has(key)) return
    inFlight.current.add(key)
    setPendingKeys(new Set(inFlight.current))
    try {
      const change = await setActivityStatus(profileId, chapterId, typeId, to)
      if (change) {
        const { name, where } = describe(chapterId, typeId)
        const what = to === 'done' ? 'done' : to === 'na' ? 'not applicable' : 'not done'
        show({
          message: `${name} · ${where}: ${what}`,
          actionLabel: 'Undo',
          onAction: () => void undo(change),
        })
      }
    } catch (e) {
      show({ message: `Not saved: ${errMsg(e)}`, tone: 'error' })
    } finally {
      inFlight.current.delete(key)
      setPendingKeys(new Set(inFlight.current))
    }
  }

  return { pendingKeys, toast, closeToast, tick }
}
