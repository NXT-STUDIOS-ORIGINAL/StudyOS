const dirty = new Set<string>()

export function markDirty(id: string, isDirty: boolean): void {
  if (isDirty) dirty.add(id)
  else dirty.delete(id)
}

export const hasUnsavedChanges = (): boolean => dirty.size > 0
