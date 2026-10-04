import { describe, expect, it } from 'vitest'
import type { Recipe, ShoppingList } from '@/api/types'
import { buildShoppingList } from './shopping'
import { food, plan, variant } from './test-data'

describe('buildShoppingList', () => {
  const egg = food({ name: 'Ou', category: 'eggs', kcal: 143, unitWeightG: 55 })
  const banana = food({ name: 'Banană', category: 'fruits', kcal: 89, unitWeightG: 120 })
  const recipe = { id: 'omleta', name: 'Omletă' } as Recipe
  const omelette = variant({ recipeId: 'omleta', name: '400 kcal', servings: 2, ingredients: [{ foodId: egg.id, grams: 220 }] })
  const breakfast = plan({
    name: 'Plan A',
    meals: [
      {
        id: 'm1',
        label: 'Breakfast',
        items: [
          { id: 'i1', kind: 'variant', variantId: omelette.id, servings: 1, foodId: null, grams: null },
          { id: 'i2', kind: 'food', variantId: null, servings: null, foodId: banana.id, grams: 120 },
        ],
      },
    ],
  })

  const lookups = {
    plans: new Map([[breakfast.id, breakfast]]),
    variants: new Map([[omelette.id, omelette]]),
    recipes: new Map([[recipe.id, recipe]]),
    foods: new Map([egg, banana].map((f) => [f.id, f])),
  }

  it('multiplies by days and groups by recipe, simple foods last', () => {
    const list = { plans: [{ mealPlanId: breakfast.id, days: 5 }], checkedKeys: [] } as unknown as ShoppingList

    const groups = buildShoppingList(list, lookups)

    expect(groups.map((g) => g.title)).toEqual(['Omletă', 'Alimente simple'])
    expect(groups[0].items[0]).toMatchObject({ name: 'Ou', grams: 550, units: 10 })
    expect(groups[1].items[0]).toMatchObject({ name: 'Banană', grams: 600, units: 5 })
  })
})
