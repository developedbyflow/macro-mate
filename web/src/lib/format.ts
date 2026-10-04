import i18n, { locale } from '@/i18n'

type Formats = { oneDecimal: Intl.NumberFormat; whole: Intl.NumberFormat; fixedOne: Intl.NumberFormat; twoDecimals: Intl.NumberFormat }

const cache = new Map<string, Formats>()

function formats() {
  const current = locale()
  let found = cache.get(current)
  if (!found) {
    found = {
      oneDecimal: new Intl.NumberFormat(current, { maximumFractionDigits: 1 }),
      whole: new Intl.NumberFormat(current, { maximumFractionDigits: 0 }),
      fixedOne: new Intl.NumberFormat(current, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      twoDecimals: new Intl.NumberFormat(current, { maximumFractionDigits: 2 }),
    }
    cache.set(current, found)
  }
  return found
}

export function kcal(value: number) {
  return formats().whole.format(Math.round(value))
}

export function grams(value: number) {
  return `${value >= 10 ? formats().whole.format(value) : formats().oneDecimal.format(value)} g`
}

export function num(value: number) {
  return Math.abs(value) >= 10 ? formats().whole.format(value) : formats().oneDecimal.format(value)
}

export function kg(value: number) {
  return `${formats().fixedOne.format(value)} kg`
}

export function perWeek(value: number) {
  return i18n.t('units.perWeek', { value: formats().twoDecimals.format(value) })
}

export function decimal(value: number) {
  return formats().twoDecimals.format(value)
}

export function mg(value: number) {
  return `${formats().whole.format(value)} mg`
}

export function servings(count: number) {
  return i18n.t('units.serving', { count, value: num(count) })
}

const spoonCategories = new Set(['oils_fats', 'sauces_condiments', 'sweets'])

export function units(count: number, category: string) {
  if (spoonCategories.has(category)) return i18n.t('units.tablespoon', { count, value: num(count) })
  return i18n.t('units.pieces', { value: num(count) })
}
