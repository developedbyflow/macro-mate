import type { Recipe } from '@/api/types'

export type RecipeDraft = Pick<Recipe, 'name' | 'instructions' | 'prepTimeMin' | 'difficulty' | 'photoId' | 'ingredientFoodIds'>

export const difficulties = [
  { value: 'easy', label: 'Ușor' },
  { value: 'medium', label: 'Mediu' },
  { value: 'hard', label: 'Greu' },
] as const

export function difficultyLabel(value: string) {
  return difficulties.find((d) => d.value === value)?.label ?? value
}

export function emptyRecipe(): RecipeDraft {
  return { name: '', instructions: '', prepTimeMin: 20, difficulty: 'easy', photoId: null, ingredientFoodIds: [] }
}
