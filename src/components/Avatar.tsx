import type { Avatar as AvatarData } from '../domain/types'
import { DEFAULT_AVATARS, initials } from '../domain/profile'

interface Props { avatar: AvatarData; name: string; size?: number }

export function Avatar({ avatar, name, size = 40 }: Props) {
  if (avatar.kind === 'image') {
    return <img src={avatar.dataUrl} alt="" width={size} height={size}
      className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  }
  const color = DEFAULT_AVATARS.find((a) => a.key === avatar.key)?.color ?? DEFAULT_AVATARS[0].color
  return (
    <span aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  )
}
