export interface StorageInfo {
  supported: boolean
  persisted: boolean | null
  usageBytes: number | null
  quotaBytes: number | null
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const s: StorageManager | undefined = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!s) return { supported: false, persisted: null, usageBytes: null, quotaBytes: null }
  const persisted = typeof s.persisted === 'function' ? await s.persisted().catch(() => null) : null
  const est = typeof s.estimate === 'function' ? await s.estimate().catch(() => null) : null
  return { supported: true, persisted, usageBytes: est?.usage ?? null, quotaBytes: est?.quota ?? null }
}

/** true = granted, false = denied, null = unsupported or failed. */
export async function requestPersistence(): Promise<boolean | null> {
  const s: StorageManager | undefined = typeof navigator !== 'undefined' ? navigator.storage : undefined
  if (!s || typeof s.persist !== 'function') return null
  try {
    return await s.persist()
  } catch {
    return null
  }
}
