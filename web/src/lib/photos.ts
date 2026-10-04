import { db } from '@/db/database'
import { requestSync } from '@/db/sync'
import i18n from '@/i18n'

async function draw(file: Blob, maxSize: number) {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * ratio)
  const height = Math.round(bitmap.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas
}

export async function compressImage(file: Blob, maxSize = 1280, quality = 0.8): Promise<Blob> {
  const canvas = await draw(file, maxSize)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(i18n.t('common.photoReadFailed')))), 'image/jpeg', quality),
  )
}

export async function imageToDataUrl(file: Blob, maxSize = 1600) {
  const canvas = await draw(file, maxSize)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export async function storePhoto(file: Blob) {
  const blob = await compressImage(file)
  const id = crypto.randomUUID()
  await db.photos.put({ id, blob, uploaded: 0 })
  requestSync()
  return id
}
