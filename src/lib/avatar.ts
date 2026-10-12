import { validateAvatarFile } from '../domain/profile'

/** Validates, centre-crops and re-encodes an image as a 256px JPEG data URL. Re-encoding also strips EXIF metadata. */
export async function fileToAvatarDataUrl(file: File, size = 256): Promise<string> {
  const problem = validateAvatarFile(file)
  if (problem) throw new Error(problem)
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('That file could not be read as an image.')
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Image processing is not available in this browser.')
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
