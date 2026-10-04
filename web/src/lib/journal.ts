import type { JournalEntry, MealItem } from '@/api/types'
import type { PickedItem } from '@/components/app/item-picker'
import { newId, saveRow } from '@/db/mutations'
import { rememberRecentFood } from '@/hooks/use-data'
import { mealItemNutrients, type FoodsById, type Nutrients, type VariantsById } from './nutrition'

type EntryInput = Omit<JournalEntry, 'userId' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>

function snapshot(n: Nutrients) {
  return {
    kcal: round(n.kcal),
    proteinG: round(n.proteinG),
    carbsG: round(n.carbsG),
    fatG: round(n.fatG),
    fiberG: round(n.fiberG),
    sodiumMg: round(n.sodiumMg),
  }
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

export function entryName(item: MealItem, foods: FoodsById, variants: VariantsById, recipeName: (recipeId: string) => string) {
  if (item.kind === 'food' && item.foodId) return foods.get(item.foodId)?.name ?? 'Aliment'
  if (item.kind === 'variant' && item.variantId) {
    const variant = variants.get(item.variantId)
    return variant ? `${recipeName(variant.recipeId)} · ${variant.name}` : 'Rețetă'
  }
  return 'Element'
}

export async function logMealItem(
  args: { date: string; mealLabel: string; item: MealItem; foods: FoodsById; variants: VariantsById; name: string; fromPlan: boolean },
  ownerId: string,
) {
  const { date, mealLabel, item, foods, variants, name, fromPlan } = args
  const entry: EntryInput = {
    id: newId(),
    date,
    mealLabel,
    mealItemId: fromPlan ? item.id : null,
    kind: item.kind,
    variantId: item.variantId,
    servings: item.servings,
    foodId: item.foodId,
    grams: item.grams,
    name,
    ...snapshot(mealItemNutrients(item, foods, variants)),
  }
  if (item.foodId) await rememberRecentFood(item.foodId)
  return saveRow('journalEntries', entry, ownerId)
}

export function pickedToMealItem(picked: PickedItem): MealItem {
  return picked.kind === 'food'
    ? { id: newId(), kind: 'food', foodId: picked.food.id, grams: picked.grams, variantId: null, servings: null }
    : { id: newId(), kind: 'variant', variantId: picked.variant.id, servings: picked.servings, foodId: null, grams: null }
}

export function pickedName(picked: PickedItem) {
  return picked.kind === 'food' ? picked.food.name : `${picked.recipe.name} · ${picked.variant.name}`
}

export async function updateEntryQuantity(entry: JournalEntry, quantity: number, foods: FoodsById, variants: VariantsById, ownerId: string) {
  const item: MealItem =
    entry.kind === 'food'
      ? { id: entry.id, kind: 'food', foodId: entry.foodId, grams: quantity, variantId: null, servings: null }
      : { id: entry.id, kind: 'variant', variantId: entry.variantId, servings: quantity, foodId: null, grams: null }

  const fresh = mealItemNutrients(item, foods, variants)
  const previous = entry.kind === 'food' ? (entry.grams ?? 0) : (entry.servings ?? 0)
  const values = fresh.kcal > 0 || previous === 0 ? snapshot(fresh) : snapshot(scaleEntry(entry, quantity / previous))

  return saveRow(
    'journalEntries',
    { ...entry, ...values, grams: item.grams, servings: item.servings },
    ownerId,
  )
}

function scaleEntry(entry: JournalEntry, factor: number): Nutrients {
  return {
    kcal: entry.kcal * factor,
    proteinG: entry.proteinG * factor,
    carbsG: entry.carbsG * factor,
    fatG: entry.fatG * factor,
    fiberG: entry.fiberG * factor,
    sodiumMg: entry.sodiumMg * factor,
  }
}

export function entryNutrients(entry: JournalEntry): Nutrients {
  return {
    kcal: entry.kcal,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    fiberG: entry.fiberG,
    sodiumMg: entry.sodiumMg,
  }
}
