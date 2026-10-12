import type { Profile, ProfileDraft } from './types'

export const DEFAULT_AVATARS = [
  { key: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { key: 'teal', label: 'Teal', color: '#0f766e' },
  { key: 'amber', label: 'Amber', color: '#b45309' },
  { key: 'rose', label: 'Rose', color: '#be123c' },
  { key: 'purple', label: 'Purple', color: '#7e22ce' },
  { key: 'blue', label: 'Blue', color: '#1d4ed8' },
]

export const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024
const MAX_AVATAR_DATA_URL_LENGTH = 400_000
const JPEG_PREFIX = 'data:image/jpeg;base64,'

export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return 'Use a PNG, JPEG or WebP image.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_AVATAR_FILE_BYTES) return 'Image is too large. Choose one under 5 MB.'
  return null
}

export function emptyProfileDraft(): ProfileDraft {
  return {
    displayName: '', nickname: '', board: '', classGrade: '',
    academicYear: '', schoolName: '', avatar: { kind: 'default', key: 'indigo' },
  }
}

export function toProfileDraft(p: Profile): ProfileDraft {
  return {
    displayName: p.displayName, nickname: p.nickname, board: p.board,
    classGrade: p.classGrade, academicYear: p.academicYear,
    schoolName: p.schoolName, avatar: p.avatar,
  }
}

export function validateProfileDraft(d: ProfileDraft): string[] {
  const errors: string[] = []
  if (d.displayName.trim().length === 0) errors.push('Display name is required.')
  if (d.displayName.length > 60) errors.push('Display name must be 60 characters or fewer.')
  if (d.nickname.length > 40) errors.push('Nickname must be 40 characters or fewer.')
  if (d.board.length > 80) errors.push('Board must be 80 characters or fewer.')
  if (d.classGrade.length > 40) errors.push('Class or grade must be 40 characters or fewer.')
  if (d.academicYear.length > 40) errors.push('Academic year must be 40 characters or fewer.')
  if (d.schoolName.length > 100) errors.push('School name must be 100 characters or fewer.')
  if (d.avatar.kind === 'default') {
    if (!DEFAULT_AVATARS.some((a) => a.key === (d.avatar as { key: string }).key))
      errors.push('Unknown default avatar.')
  } else if (
    !d.avatar.dataUrl.startsWith(JPEG_PREFIX) ||
    d.avatar.dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH
  ) {
    errors.push('Avatar image is invalid or too large.')
  }
  return errors
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}
