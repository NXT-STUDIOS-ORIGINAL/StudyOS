import type { Profile, ProfileSettings } from '../domain/types'

export function Dashboard({ profile, settings }: { profile: Profile; settings: ProfileSettings }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Hello, {profile.nickname || profile.displayName}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Goals: {settings.dailyTargetMinutes / 60} h per day, {settings.weeklyTargetMinutes / 60} h per week.
        Dashboard widgets are built once there is real data (subjects, sessions, tests) to calculate
        from. Nothing here is placeholder data.
      </p>
    </div>
  )
}
