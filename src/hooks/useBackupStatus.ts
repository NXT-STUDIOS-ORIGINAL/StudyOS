import { useLiveQuery } from 'dexie-react-hooks'
import { readBackupStatus, type BackupStatus } from '../lib/backupState'

export function useBackupStatus(): BackupStatus | undefined {
  return useLiveQuery(readBackupStatus, [])
}
