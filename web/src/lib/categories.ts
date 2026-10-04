import i18n from '@/i18n'

export const categoryCodes = [
  'vegetables',
  'starchy_vegetables',
  'fruits',
  'berries',
  'poultry',
  'red_meat',
  'cured_meats',
  'fish_seafood',
  'eggs',
  'dairy',
  'cheese',
  'grains_pasta',
  'bread_bakery',
  'legumes',
  'nuts_seeds',
  'oils_fats',
  'sauces_condiments',
  'sweets',
  'drinks',
] as const

export type CategoryCode = (typeof categoryCodes)[number]

export function isCategoryCode(code: string): code is CategoryCode {
  return (categoryCodes as readonly string[]).includes(code)
}

export function categoryLabel(code: string) {
  return isCategoryCode(code) ? i18n.t(`categories.${code}`) : code
}
