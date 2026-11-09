export const DOG_PHOTO_BUCKET = 'dog-photos'
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export function photoPath(householdId: string, dogId: string) {
 return `${householdId}/${dogId}.jpg`
}
export function validatePhoto(file: Pick<File, 'size' | 'type'>) {
 if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo. On iPhone, you can also choose Take Photo.')
 if (file.size === 0) throw new Error('This file is empty. Please choose another photo.')
 if (file.size > MAX_PHOTO_BYTES) throw new Error('Choose a photo smaller than 10 MB.')
}
// Re-encoding bounds storage size and removes location/EXIF metadata.
export async function preparePhoto(file: File): Promise<Blob> {
 validatePhoto(file)
 const url = URL.createObjectURL(file)
 try {
  const image = new Image()
  image.src = url
  await image.decode().catch(() => { throw new Error('This photo could not be opened. Try a JPG, PNG, or WebP image.') })
  const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the photo. Please try another browser.')
  context.fillStyle = '#f7f8f2'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to prepare the photo.')), 'image/jpeg', 0.85))
 } finally { URL.revokeObjectURL(url) }
}
