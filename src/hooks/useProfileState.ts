import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { DEFAULT_SETTINGS } from '../domain/settings'
import type { Profile, ProfileSettings } from '../domain/types'

export interface ProfileState {
  profiles: Profile[]
  active: Profile | null
  settings: ProfileSettings | null
}

/** undefined while loading. Re-runs automatically when profiles or settings change. */
export function useProfileState(): ProfileState | undefined {
  return useLiveQuery(async (): Promise<ProfileState> => {
    const profiles = (await db.profiles.toArray()).sort((a, b) => a.createdAt - b.createdAt)
    const row = await db.appState.get('activeProfileId')
    const active = profiles.find((p) => p.id === row?.value) ?? profiles[0] ?? null
    if (!active) return { profiles, active: null, settings: null }
    const stored = await db.profileSettings.get(active.id)
    const settings = stored ?? { ...DEFAULT_SETTINGS, profileId: active.id, updatedAt: 0 }
    return { profiles, active, settings }
  }, [])
}
