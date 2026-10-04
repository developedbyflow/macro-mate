import type { Food, MealPlan, Recipe, RecipeVariant, ShoppingList } from '@/api/types'

export type ShoppingItem = {
  key: string
  foodId: string
  name: string
  grams: number
  units: number | null
  category: string
}

export type ShoppingGroup = {
  key: string
  title: string
  subtitle: string | null
  items: ShoppingItem[]
}

type Lookups = {
  plans: Map<string, MealPlan>
  variants: Map<string, RecipeVariant>
  recipes: Map<string, Recipe>
  foods: Map<string, Food>
}

export const simpleGroupKey = 'simple'

export function buildShoppingList(list: ShoppingList, lookups: Lookups): ShoppingGroup[] {
  const groups = new Map<string, { title: string; variantNames: Set<string>; grams: Map<string, number> }>()

  function addGrams(groupKey: string, title: string, variantName: string | null, foodId: string, grams: number) {
    let group = groups.get(groupKey)
    if (!group) {
      group = { title, variantNames: new Set(), grams: new Map() }
      groups.set(groupKey, group)
    }
    if (variantName) group.variantNames.add(variantName)
    group.grams.set(foodId, (group.grams.get(foodId) ?? 0) + grams)
  }

  for (const entry of list.plans) {
    const plan = lookups.plans.get(entry.mealPlanId)
    if (!plan || plan.deletedAt) continue
    for (const meal of plan.meals) {
      for (const item of meal.items) {
        if (item.kind === 'variant' && item.variantId) {
          const variant = lookups.variants.get(item.variantId)
          if (!variant) continue
          const recipe = lookups.recipes.get(variant.recipeId)
          const factor = ((item.servings ?? 1) / Math.max(1, variant.servings)) * entry.days
          for (const ingredient of variant.ingredients) {
            addGrams(`recipe:${variant.recipeId}`, recipe?.name ?? 'Rețetă ștearsă', variant.name, ingredient.foodId, ingredient.grams * factor)
          }
        } else if (item.kind === 'food' && item.foodId) {
          addGrams(simpleGroupKey, 'Alimente simple', null, item.foodId, (item.grams ?? 0) * entry.days)
        }
      }
    }
  }

  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      title: group.title,
      subtitle: group.variantNames.size > 0 ? [...group.variantNames].join(', ') : null,
      items: [...group.grams.entries()]
        .map(([foodId, grams]) => {
          const food = lookups.foods.get(foodId)
          const unit = food?.unitWeightG ?? null
          return {
            key: `${key}:${foodId}`,
            foodId,
            name: food?.name ?? 'Aliment șters',
            grams: Math.round(grams),
            units: unit ? Math.ceil(grams / unit) : null,
            category: food?.category ?? '',
          }
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'ro')),
    }))
    .sort((a, b) => (a.key === simpleGroupKey ? 1 : b.key === simpleGroupKey ? -1 : a.title.localeCompare(b.title, 'ro')))
}
