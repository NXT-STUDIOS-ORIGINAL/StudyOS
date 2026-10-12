import { useEffect, useId } from 'react'
import { markDirty } from '../lib/dirty'

export function useDirtyGuard(isDirty: boolean): void {
  const id = useId()
  useEffect(() => {
    markDirty(id, isDirty)
    return () => markDirty(id, false)
  }, [id, isDirty])
}
