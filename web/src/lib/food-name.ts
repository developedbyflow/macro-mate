import type { Food } from '@/api/types'
import { currentLanguage } from '@/i18n'

type Named = Pick<Food, 'name' | 'nameEn'>

export function foodName(food: Named): string
export function foodName(food: Named | null | undefined): string | undefined
export function foodName(food: Named | null | undefined) {
  if (!food) return undefined
  return currentLanguage() === 'en' && food.nameEn ? food.nameEn : food.name
}

export function foodSearchText(food: Named & Pick<Food, 'brand'>) {
  return [food.name, food.nameEn, food.brand].filter(Boolean).join(' ')
}

export function primaryNameField(): 'name' | 'nameEn' {
  return currentLanguage() === 'en' ? 'nameEn' : 'name'
}
