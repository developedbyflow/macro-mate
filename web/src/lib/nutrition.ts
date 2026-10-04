import type { Food, MealItem, MealPlan, RecipeVariant } from '@/api/types'

export type Nutrients = {
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  fiberG: number
  sodiumMg: number
}

export type Grade = 'A' | 'B' | 'C'

export const zero: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, sodiumMg: 0 }

const keys = Object.keys(zero) as (keyof Nutrients)[]

export function add(a: Nutrients, b: Nutrients): Nutrients {
  return Object.fromEntries(keys.map((k) => [k, a[k] + b[k]])) as Nutrients
}

export function scale(n: Nutrients, factor: number): Nutrients {
  return Object.fromEntries(keys.map((k) => [k, n[k] * factor])) as Nutrients
}

export function subtract(a: Nutrients, b: Nutrients): Nutrients {
  return add(a, scale(b, -1))
}

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(add, zero)
}

export function per100(food: Food): Nutrients {
  return {
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatG: food.fatG,
    fiberG: food.fiberG,
    sodiumMg: food.sodiumMg,
  }
}

export function forGrams(food: Food, grams: number): Nutrients {
  return scale(per100(food), grams / 100)
}

export type FoodsById = Map<string, Food>
export type VariantsById = Map<string, RecipeVariant>

export function variantTotals(variant: RecipeVariant, foods: FoodsById) {
  let total = zero
  let grams = 0
  let missing = 0
  for (const ingredient of variant.ingredients) {
    const food = foods.get(ingredient.foodId)
    if (!food) {
      missing++
      continue
    }
    total = add(total, forGrams(food, ingredient.grams))
    grams += ingredient.grams
  }
  const servings = Math.max(1, variant.servings)
  return { total, perServing: scale(total, 1 / servings), grams, gramsPerServing: grams / servings, missing }
}

const gradeValue: Record<Grade, number> = { A: 1, B: 2, C: 3 }

export function gradeFromValue(value: number): Grade {
  if (value < 1.5) return 'A'
  if (value < 2.5) return 'B'
  return 'C'
}

export function variantScores(variant: RecipeVariant, foods: FoodsById) {
  let carbs = 0
  let carbsWeighted = 0
  let kcal = 0
  let kcalWeighted = 0

  for (const ingredient of variant.ingredients) {
    const food = foods.get(ingredient.foodId)
    if (!food) continue
    const n = forGrams(food, ingredient.grams)
    if (food.glycemicGrade) {
      carbs += n.carbsG
      carbsWeighted += n.carbsG * gradeValue[food.glycemicGrade as Grade]
    }
    if (food.weightLossGrade) {
      kcal += n.kcal
      kcalWeighted += n.kcal * gradeValue[food.weightLossGrade as Grade]
    }
  }

  const carbsPerServing = carbs / Math.max(1, variant.servings)
  const glycemicGrade: Grade | null =
    variant.ingredients.length === 0 ? null : carbsPerServing < 5 ? 'A' : gradeFromValue(carbsWeighted / carbs)
  const weightLossGrade: Grade | null = kcal > 0 ? gradeFromValue(kcalWeighted / kcal) : null
  return { glycemicGrade, weightLossGrade }
}

export function mealItemNutrients(item: MealItem, foods: FoodsById, variants: VariantsById): Nutrients {
  if (item.kind === 'variant' && item.variantId) {
    const variant = variants.get(item.variantId)
    if (!variant) return zero
    return scale(variantTotals(variant, foods).perServing, item.servings ?? 1)
  }
  if (item.kind === 'food' && item.foodId) {
    const food = foods.get(item.foodId)
    if (!food) return zero
    return forGrams(food, item.grams ?? 0)
  }
  return zero
}

export function planTotals(plan: MealPlan, foods: FoodsById, variants: VariantsById) {
  const meals = plan.meals.map((meal) => sum(meal.items.map((item) => mealItemNutrients(item, foods, variants))))
  return { meals, total: sum(meals) }
}

export type Alternative = { food: Food; grams: number }

export type Exclusions = { foodIds: Set<string>; categories: Set<string> }

function composition(food: Food) {
  if (food.kcal <= 0) return { p: 0, c: 0, f: 0 }
  return {
    p: (food.proteinG * 4) / food.kcal,
    c: (food.carbsG * 4) / food.kcal,
    f: (food.fatG * 9) / food.kcal,
  }
}

export function foodDistance(a: Food, b: Food) {
  const ca = composition(a)
  const cb = composition(b)
  const density = a.kcal > 0 && b.kcal > 0 ? Math.abs(Math.log(a.kcal / b.kcal)) : 1
  return Math.abs(ca.p - cb.p) + Math.abs(ca.c - cb.c) + Math.abs(ca.f - cb.f) + 0.2 * density
}

export function alternativesFor(food: Food, grams: number, all: Food[], exclusions: Exclusions, count = 2): Alternative[] {
  return all
    .filter(
      (candidate) =>
        candidate.id !== food.id &&
        candidate.deletedAt == null &&
        candidate.category === food.category &&
        !exclusions.foodIds.has(candidate.id) &&
        !exclusions.categories.has(candidate.category),
    )
    .map((candidate) => ({ candidate, distance: foodDistance(food, candidate) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ candidate }) => ({
      food: candidate,
      grams: food.kcal > 0 && candidate.kcal > 0 ? Math.round((grams * food.kcal) / candidate.kcal) : grams,
    }))
}

export function isExcluded(food: Food, exclusions: Exclusions) {
  return exclusions.foodIds.has(food.id) || exclusions.categories.has(food.category)
}
