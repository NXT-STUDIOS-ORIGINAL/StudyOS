import Dexie, { type Table } from 'dexie'
import type { Settings } from '../domain/types'

export class StudyOSDB extends Dexie {
  settings!: Table<Settings, string>

  constructor() {
    super('studyos')
    // Schema versions are append-only. Add new tables as version(2), version(3)...
    this.version(1).stores({ settings: 'id' })
  }
}

export const db = new StudyOSDB()

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ ...s, id: 'main', updatedAt: Date.now() })
}
