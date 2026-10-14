import { useState } from 'react'
import type { Profile, ProfileSettings } from '../domain/types'

export function Dashboard({ profile, settings }: { profile: Profile; settings: ProfileSettings }) {
  const [notice] = useState<string | null>(() => {
    try {
      const n = sessionStorage.getItem('studyos.notice')
      if (n) sessionStorage.removeItem('studyos.notice')
      return n
    } catch {
      return null
    }
  })
  return (
    <div className="max-w-2xl">
      {notice && <p role="status" className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">{notice} Open Profiles to verify your records.</p>}
      <h1 className="text-2xl font-semibold">Hello, {profile.nickname || profile.displayName}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Goals: {settings.dailyTargetMinutes / 60} h per day, {settings.weeklyTargetMinutes / 60} h per week.
        Dashboard widgets are built once there is real data to calculate from. Nothing here is placeholder data.
      </p>
    </div>
  )
}
