import { db, getMeta } from '@/db/database'
import { deleteRow, saveRow } from '@/db/mutations'

export async function pantryItemId(kitchenId: string, foodId: string) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kitchenId}:${foodId}`)))
  const hex = Array.from(hash.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function addToPantry(foodId: string, ownerId: string) {
  const kitchenId = await getMeta('kitchenId')
  if (!kitchenId) return
  await saveRow('pantryItems', { id: await pantryItemId(kitchenId, foodId), foodId }, ownerId)
}

export async function removeFromPantry(foodId: string) {
  const items = await db.pantryItems.where('foodId').equals(foodId).toArray()
  for (const item of items.filter((i) => i.deletedAt == null)) await deleteRow('pantryItems', item.id)
}

export async function togglePantry(foodId: string, inPantry: boolean, ownerId: string) {
  if (inPantry) await removeFromPantry(foodId)
  else await addToPantry(foodId, ownerId)
}
