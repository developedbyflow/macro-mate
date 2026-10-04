import type { Recipe } from '@/api/types'
import i18n from '@/i18n'

export type RecipeDraft = Pick<Recipe, 'name' | 'instructions' | 'prepTimeMin' | 'difficulty' | 'photoId' | 'ingredientFoodIds'>

export const difficulties = [
  {
    value: 'easy',
    get label() {
      return i18n.t('difficulty.easy')
    },
  },
  {
    value: 'medium',
    get label() {
      return i18n.t('difficulty.medium')
    },
  },
  {
    value: 'hard',
    get label() {
      return i18n.t('difficulty.hard')
    },
  },
] as const

export function difficultyLabel(value: string) {
  return difficulties.find((d) => d.value === value)?.label ?? value
}

export function recipeSteps(instructions: string) {
  return instructions
    .split('\n')
    .map((step) => step.replace(/^\s*(\d+\s*[.)]|[-•*])\s*/, '').trim())
    .filter(Boolean)
}

export function emptyRecipe(): RecipeDraft {
  return { name: '', instructions: '', prepTimeMin: 20, difficulty: 'easy', photoId: null, ingredientFoodIds: [] }
}
