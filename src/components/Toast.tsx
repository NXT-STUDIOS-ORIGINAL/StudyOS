import { useEffect } from 'react'

export interface ToastData {
  id: number
  message: string
  tone?: 'ok' | 'error'
  actionLabel?: string
  onAction?: () => void
}

export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, toast.tone === 'error' ? 10000 : 6000)
    return () => clearTimeout(t)
  }, [toast, onClose])
  if (!toast) return null
  const error = toast.tone === 'error'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div role={error ? 'alert' : 'status'}
        className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-1 text-sm shadow-lg ${error ? 'bg-red-700 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>
        <span className="min-w-0 flex-1 py-2">{toast.message}</span>
        {toast.actionLabel && toast.onAction && (
          <button type="button" className="min-h-11 rounded-lg px-3 font-semibold underline"
            onClick={() => { toast.onAction?.(); onClose() }}>
            {toast.actionLabel}
          </button>
        )}
        <button type="button" aria-label="Dismiss" className="min-h-11 min-w-11 rounded-lg" onClick={onClose}>×</button>
      </div>
    </div>
  )
}
