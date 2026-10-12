import { useEffect, useRef, type ReactNode } from 'react'
import { dangerBtn, primaryBtn, secondaryBtn } from './ui'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, children, confirmLabel, danger, busy, error, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref}
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel() }}
      className="w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
      <div className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">{children}</div>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" className={secondaryBtn} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={danger ? dangerBtn : primaryBtn} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
