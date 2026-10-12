import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3, BookOpen, CalendarDays, GraduationCap, LayoutDashboard,
  PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon, Timer,
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/syllabus', label: 'Syllabus', icon: BookOpen },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/exams', label: 'Exams', icon: GraduationCap },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('studyos.sidebar') === 'collapsed',
  )
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('studyos.sidebar', next ? 'collapsed' : 'open') } catch { /* UI preference only */ }
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3 focus:text-slate-900">
        Skip to content
      </a>

      <aside className={`hidden shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col dark:border-slate-800 dark:bg-slate-900 ${collapsed ? 'w-16' : 'w-56'}`}>
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && <span className="text-lg font-semibold">StudyOS</span>}
          <button onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 p-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}>
              <Icon size={20} aria-hidden />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main id="main" className="min-w-0 flex-1 p-4 pb-24 md:p-8 md:pb-8">
        <Outlet />
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                isActive ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'
              }`}>
            <Icon size={20} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
