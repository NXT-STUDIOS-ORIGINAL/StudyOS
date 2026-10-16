import type { ReactNode } from 'react'

interface Props { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: ReactNode }

export function IconBtn({ label, onClick, disabled, pressed, children }: Props) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} aria-pressed={pressed} onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800 ${pressed ? 'text-indigo-600 dark:text-indigo-300' : ''}`}>
      {children}
    </button>
  )
}
