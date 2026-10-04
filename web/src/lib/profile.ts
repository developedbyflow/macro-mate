import type { UserProfile } from '@/api/types'
import { saveRow } from '@/db/mutations'

type ListField = 'favoriteFoodIds' | 'favoriteRecipeIds' | 'excludedFoodIds' | 'excludedCategories' | 'excludedRecipeIds' | 'likedFoodIds'

export async function toggleInProfile(profile: UserProfile | undefined, field: ListField, value: string) {
  if (!profile) return
  const list = profile[field] as string[]
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  await saveRow('userProfiles', { ...profile, [field]: next }, profile.userId)
}

export function inProfile(profile: UserProfile | undefined, field: ListField, value: string) {
  return (profile?.[field] as string[] | undefined)?.includes(value) ?? false
}
