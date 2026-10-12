import type { Settings } from '../domain/types'

export function Dashboard({ settings }: { settings: Settings }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">
        {settings.name ? `Hello, ${settings.name}` : 'Dashboard'}
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Your daily target is {settings.dailyTargetMinutes / 60} h. Dashboard widgets are built in
        Phase 4, once there is real data (subjects, sessions, tests) to calculate from. Nothing
        here is placeholder data.
      </p>
    </div>
  )
}
