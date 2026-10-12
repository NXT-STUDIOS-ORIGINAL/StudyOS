import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './lib/db'
import { DEFAULT_SETTINGS } from './domain/settings'
import type { Settings } from './domain/types'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { SettingsPage } from './pages/SettingsPage'
import { Onboarding } from './pages/Onboarding'
import { ComingSoon } from './pages/ComingSoon'

function useApplyTheme(settings: Settings | null | undefined) {
  const theme = settings?.theme ?? 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches))
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export default function App() {
  // undefined = still loading, null = no settings saved yet
  const settings = useLiveQuery(async () => (await db.settings.get('main')) ?? null, [])
  useApplyTheme(settings)

  if (settings === undefined) {
    return <p role="status" className="p-8">Loading…</p>
  }
  if (settings === null || !settings.onboarded) {
    return <Onboarding initial={settings ?? DEFAULT_SETTINGS} />
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard settings={settings} />} />
          <Route path="syllabus" element={<ComingSoon title="Syllabus" phase={2} />} />
          <Route path="planner" element={<ComingSoon title="Planner" phase={2} />} />
          <Route path="focus" element={<ComingSoon title="Focus timer" phase={2} />} />
          <Route path="exams" element={<ComingSoon title="Exams" phase={3} />} />
          <Route path="analytics" element={<ComingSoon title="Analytics" phase={4} />} />
          <Route path="settings" element={<SettingsPage settings={settings} />} />
          <Route path="*" element={<ComingSoon title="Page not found" phase={1} />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
