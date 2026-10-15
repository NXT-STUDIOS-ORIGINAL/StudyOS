import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import type { ThemeChoice } from './domain/types'
import { useProfileState } from './hooks/useProfileState'
import { AppShell } from './components/AppShell'
import { Dashboard } from './pages/Dashboard'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilesPage } from './pages/Profiles'
import { Onboarding } from './pages/Onboarding'
import { ComingSoon } from './pages/ComingSoon'
import { BackupPage } from './pages/BackupPage'
import { SyllabusPage } from './pages/Syllabus'

function useApplyTheme(theme: ThemeChoice) {
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
  const state = useProfileState() // undefined while loading
  useApplyTheme(state?.settings?.theme ?? 'system')

  if (state === undefined) return <p role="status" className="p-8">Loading…</p>
  const { profiles, active, settings } = state
  if (!active || !settings) return <Onboarding />

  return (
    <HashRouter>
      <Routes>
        {/* key remounts the whole shell and page on profile switch, so no state leaks between profiles */}
        <Route element={<AppShell key={active.id} profiles={profiles} active={active} />}>
          <Route index element={<Dashboard profile={active} settings={settings} />} />
          <Route path="syllabus" element={<SyllabusPage profile={active} />} />
          <Route path="planner" element={<ComingSoon title="Planner" phase={2} />} />
          <Route path="focus" element={<ComingSoon title="Focus timer" phase={2} />} />
          <Route path="exams" element={<ComingSoon title="Exams" phase={3} />} />
          <Route path="analytics" element={<ComingSoon title="Analytics" phase={4} />} />
          <Route path="profiles" element={<ProfilesPage profiles={profiles} active={active} />} />
          <Route path="backup" element={<BackupPage profiles={profiles} active={active} />} />
          <Route path="settings" element={<SettingsPage profile={active} settings={settings} />} />
          <Route path="*" element={<ComingSoon title="Page not found" phase={1} />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
