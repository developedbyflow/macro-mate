const oneDecimal = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 })
const whole = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 })
const fixedOne = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const twoDecimals = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 })

export function kcal(value: number) {
  return whole.format(Math.round(value))
}

export function grams(value: number) {
  return `${value >= 10 ? whole.format(value) : oneDecimal.format(value)} g`
}

export function num(value: number) {
  return Math.abs(value) >= 10 ? whole.format(value) : oneDecimal.format(value)
}

export function kg(value: number) {
  return `${fixedOne.format(value)} kg`
}

export function perWeek(value: number) {
  return `${twoDecimals.format(value)} kg pe săptămână`
}

export function decimal(value: number) {
  return twoDecimals.format(value)
}

export function mg(value: number) {
  return `${whole.format(value)} mg`
}

const spoonCategories = new Set(['oils_fats', 'sauces_condiments', 'sweets'])

export function units(count: number, category: string) {
  if (spoonCategories.has(category)) return `${num(count)} ${count === 1 ? 'lingură' : 'linguri'}`
  return `${num(count)} buc`
}
