import i18n from '@/i18n'
import { en } from '@/i18n/en'
import { ro } from '@/i18n/ro'

const mealKeys = ['breakfast', 'lunch', 'dinner', 'snack', 'extra'] as const

type MealKey = (typeof mealKeys)[number]

export function mealKey(label: string): MealKey | null {
  return mealKeys.find((key) => ro.meals[key] === label || en.meals[key] === label) ?? null
}

export function mealLabel(label: string) {
  const key = mealKey(label)
  return key ? i18n.t(`meals.${key}`) : label
}

export function mealRank(label: string) {
  const key = mealKey(label)
  return key ? mealKeys.indexOf(key) : mealKeys.length
}

export function sameMeal(a: string, b: string) {
  if (a === b) return true
  const key = mealKey(a)
  return key != null && key === mealKey(b)
}

export function defaultMeals(count: number) {
  return mealKeys.slice(0, Math.min(count, 4)).map((key) => i18n.t(`meals.${key}`))
}

export function extraMeal() {
  return i18n.t('meals.extra')
}
