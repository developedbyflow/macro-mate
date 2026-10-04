import { api } from '@/api/client'
import type { Food } from '@/api/types'
import i18n from '@/i18n'

const nutrientLabels = { kcal: 'kcal', proteinG: 'protein', carbsG: 'carbs', fatG: 'fat', fiberG: 'fiber', sodiumMg: 'sodium' } as const

function field<K extends keyof typeof nutrientLabels, U extends string>(key: K, unit: U) {
  return {
    key,
    unit,
    get label() {
      return i18n.t(`nutrients.${nutrientLabels[key]}`)
    },
  }
}

export const nutrientFields = [
  field('kcal', 'kcal'),
  field('proteinG', 'g'),
  field('carbsG', 'g'),
  field('fatG', 'g'),
  field('fiberG', 'g'),
  field('sodiumMg', 'mg'),
] as const

export type NutrientKey = (typeof nutrientFields)[number]['key']

export type FoodDraft = {
  name: string
  nameEn: string
  brand: string
  barcode: string
  category: string
  values: Record<NutrientKey, string>
  unitWeightG: string
  glycemicGrade: string | null
  gradesReason: string | null
  estimatedFields: string[]
  source: string
  photoId: string | null
}

export function emptyDraft(): FoodDraft {
  return {
    name: '',
    nameEn: '',
    brand: '',
    barcode: '',
    category: '',
    values: { kcal: '', proteinG: '', carbsG: '', fatG: '', fiberG: '', sodiumMg: '' },
    unitWeightG: '',
    glycemicGrade: null,
    gradesReason: null,
    estimatedFields: [],
    source: 'manual',
    photoId: null,
  }
}

export function draftFromFood(food: Food): FoodDraft {
  return {
    name: food.name,
    nameEn: food.nameEn ?? '',
    brand: food.brand ?? '',
    barcode: food.barcode ?? '',
    category: food.category,
    values: Object.fromEntries(nutrientFields.map((f) => [f.key, String(food[f.key])])) as Record<NutrientKey, string>,
    unitWeightG: food.unitWeightG ? String(food.unitWeightG) : '',
    glycemicGrade: food.glycemicGrade,
    gradesReason: food.gradesReason,
    estimatedFields: food.estimatedFields,
    source: food.source,
    photoId: food.photoId,
  }
}

export function parseNumber(text: string) {
  const value = Number.parseFloat(text.replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

export function draftValues(draft: FoodDraft) {
  return Object.fromEntries(nutrientFields.map((f) => [f.key, parseNumber(draft.values[f.key])])) as Record<NutrientKey, number | null>
}

export async function enrichDraft(draft: FoodDraft, labelImageDataUrl?: string): Promise<FoodDraft> {
  const values = draftValues(draft)
  const result = await api.enrichFood({
    name: draft.name.trim() || null,
    nameEn: draft.nameEn.trim() || null,
    brand: draft.brand.trim() || null,
    values,
    labelImageDataUrl: labelImageDataUrl ?? null,
  })
  return {
    ...draft,
    name: draft.name.trim() || result.name,
    nameEn: draft.nameEn.trim() || result.nameEn,
    category: draft.category || result.category,
    values: Object.fromEntries(nutrientFields.map((f) => [f.key, String(result[f.key])])) as Record<NutrientKey, string>,
    glycemicGrade: result.glycemicGrade,
    gradesReason: result.reason,
    estimatedFields: [...new Set([...draft.estimatedFields.filter((k) => values[k as NutrientKey] == null), ...result.estimatedFields])],
    source: labelImageDataUrl ? 'label_photo' : draft.source,
  }
}

export function foodFromDraft(draft: FoodDraft) {
  const values = draftValues(draft)
  return {
    name: draft.name.trim() || draft.nameEn.trim(),
    nameEn: draft.nameEn.trim() || null,
    brand: draft.brand.trim() || null,
    barcode: draft.barcode.trim() || null,
    category: draft.category,
    kcal: values.kcal ?? 0,
    proteinG: values.proteinG ?? 0,
    carbsG: values.carbsG ?? 0,
    fatG: values.fatG ?? 0,
    fiberG: values.fiberG ?? 0,
    sodiumMg: values.sodiumMg ?? 0,
    unitWeightG: parseNumber(draft.unitWeightG),
    glycemicGrade: draft.glycemicGrade,
    gradesReason: draft.gradesReason,
    estimatedFields: draft.estimatedFields,
    source: draft.source,
    photoId: draft.photoId,
  }
}
