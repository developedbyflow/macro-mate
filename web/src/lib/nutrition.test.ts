import { describe, expect, it } from 'vitest'
import { alternativesFor, mealItemNutrients, variantScores, variantTotals } from './nutrition'
import { food, variant } from './test-data'

const egg = food({ name: 'Ou', category: 'eggs', kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, insulinGrade: 'A', weightLossScore: 7 })
const oil = food({ name: 'Ulei', category: 'oils_fats', kcal: 884, fatG: 100, insulinGrade: 'A', weightLossScore: 1 })
const bread = food({ name: 'Pâine albă', category: 'bread_bakery', kcal: 265, proteinG: 9, carbsG: 49, fatG: 3.2, insulinGrade: 'C', weightLossScore: 3 })
const apple = food({ name: 'Măr', category: 'fruits', kcal: 52, carbsG: 14, insulinGrade: 'A', weightLossScore: 8 })
const foods = new Map([egg, oil, bread, apple].map((f) => [f.id, f]))

describe('variantTotals', () => {
  it('adds the ingredients and splits them per serving', () => {
    const omelette = variant({
      recipeId: 'r',
      servings: 2,
      ingredients: [
        { foodId: egg.id, grams: 200 },
        { foodId: oil.id, grams: 10 },
      ],
    })

    const { total, perServing, grams } = variantTotals(omelette, foods)

    expect(total.kcal).toBeCloseTo(286 + 88.4)
    expect(perServing.kcal).toBeCloseTo((286 + 88.4) / 2)
    expect(grams).toBe(210)
  })
})

describe('variantScores', () => {
  it('weighs the weight-loss score by calories, so a little oil still counts', () => {
    const omelette = variant({ recipeId: 'r', ingredients: [{ foodId: egg.id, grams: 200 }, { foodId: oil.id, grams: 10 }] })

    const { weightLossScore } = variantScores(omelette, foods)

    expect(weightLossScore).toBe(Math.round((286 * 7 + 88.4 * 1) / (286 + 88.4)))
  })

  it('gives A when a serving has almost no carbohydrates', () => {
    const omelette = variant({ recipeId: 'r', ingredients: [{ foodId: egg.id, grams: 200 }] })
    expect(variantScores(omelette, foods).insulinGrade).toBe('A')
  })

  it('weighs the insulin grade by the carbohydrates each ingredient brings', () => {
    const sandwich = variant({ recipeId: 'r', ingredients: [{ foodId: bread.id, grams: 100 }, { foodId: apple.id, grams: 50 }] })
    expect(variantScores(sandwich, foods).insulinGrade).toBe('C')
  })
})

describe('alternativesFor', () => {
  const strawberries = food({ name: 'Căpșuni', category: 'berries', kcal: 32, proteinG: 0.7, carbsG: 7.7, fatG: 0.3 })
  const raspberries = food({ name: 'Zmeură', category: 'berries', kcal: 52, proteinG: 1.2, carbsG: 12, fatG: 0.7 })
  const blueberries = food({ name: 'Afine', category: 'berries', kcal: 57, proteinG: 0.7, carbsG: 14.5, fatG: 0.3 })
  const blackberries = food({ name: 'Mure', category: 'berries', kcal: 43, proteinG: 1.4, carbsG: 9.6, fatG: 0.5 })
  const tomatoes = food({ name: 'Roșii', category: 'vegetables', kcal: 18, proteinG: 0.9, carbsG: 3.9, fatG: 0.2 })
  const all = [strawberries, raspberries, blueberries, blackberries, tomatoes]
  const none = { foodIds: new Set<string>(), categories: new Set<string>() }

  it('stays in the same category', () => {
    const result = alternativesFor(strawberries, 100, all, none)
    expect(result).toHaveLength(2)
    expect(result.map((a) => a.food.name)).not.toContain('Roșii')
  })

  it('keeps the same calories by adjusting the grams', () => {
    const [first] = alternativesFor(strawberries, 100, all, none)
    expect(first.grams).toBe(Math.round((100 * 32) / first.food.kcal))
  })

  it('skips excluded foods', () => {
    const exclusions = { foodIds: new Set([blackberries.id, raspberries.id]), categories: new Set<string>() }
    expect(alternativesFor(strawberries, 100, all, exclusions).map((a) => a.food.name)).toEqual(['Afine'])
  })
})

describe('mealItemNutrients', () => {
  it('counts a recipe item by servings and a food item by grams', () => {
    const omelette = variant({ recipeId: 'r', servings: 2, ingredients: [{ foodId: egg.id, grams: 200 }] })
    const variants = new Map([[omelette.id, omelette]])

    const fromRecipe = mealItemNutrients({ id: 'i1', kind: 'variant', variantId: omelette.id, servings: 1, foodId: null, grams: null }, foods, variants)
    const fromFood = mealItemNutrients({ id: 'i2', kind: 'food', variantId: null, servings: null, foodId: apple.id, grams: 180 }, foods, variants)

    expect(fromRecipe.kcal).toBeCloseTo(143)
    expect(fromFood.kcal).toBeCloseTo(93.6)
  })
})
