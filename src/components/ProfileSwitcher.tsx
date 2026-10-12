import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronsUpDown } from 'lucide-react'
import type { Profile } from '../domain/types'
import { Avatar } from './Avatar'
import { useProfileSwitch } from './useProfileSwitch'

interface Props {
  profiles: Profile[]
  active: Profile
  placement: 'up' | 'down'
  compact?: boolean
}

export function ProfileSwitcher({ profiles, active, placement, compact }: Props) {
  const [open, setOpen] = useState(false)
  const { request, dialog, error } = useProfileSwitch()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const label = active.nickname || active.displayName
  const pos = placement === 'up' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-2'

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="true"
        aria-label={`Active profile: ${label}. Switch profile`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
        <Avatar avatar={active.avatar} name={active.displayName} size={32} />
        {!compact && <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{label}</span>}
        {!compact && <ChevronsUpDown size={16} aria-hidden />}
      </button>
      {error && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{error}</p>}
      {open && (
        <>
          <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default" />
          <div className={`absolute z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900 ${pos}`}>
            <ul aria-label="Profiles" className="space-y-1">
              {profiles.map((p) => (
                <li key={p.id}>
                  <button type="button" aria-current={p.id === active.id ? 'true' : undefined}
                    onClick={() => { setOpen(false); if (p.id !== active.id) request(p.id) }}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${p.id === active.id ? 'bg-indigo-50 dark:bg-indigo-950' : ''}`}>
                    <Avatar avatar={p.avatar} name={p.displayName} size={28} />
                    <span className="min-w-0 flex-1 truncate">{p.nickname || p.displayName}</span>
                    {p.id === active.id && <span className="text-xs text-indigo-700 dark:text-indigo-300">Active</span>}
                  </button>
                </li>
              ))}
            </ul>
            <Link to="/profiles" onClick={() => setOpen(false)}
              className="mt-2 flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-indigo-700 hover:bg-slate-100 dark:text-indigo-300 dark:hover:bg-slate-800">
              Manage profiles
            </Link>
          </div>
        </>
      )}
      {dialog}
    </div>
  )
}
