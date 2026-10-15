import { useEffect, useRef, type ReactNode } from 'react'

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode }

export function Modal({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose() }}
      className="w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {open && children}
      </div>
    </dialog>
  )
}
