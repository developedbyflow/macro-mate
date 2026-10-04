import type { Food, JournalEntry, MealPlan, RecipeVariant, WeightEntry } from '@/api/types'

let counter = 0

export function food(overrides: Partial<Food> & Pick<Food, 'name' | 'category' | 'kcal'>): Food {
  return {
    id: `food-${++counter}`,
    brand: null,
    barcode: null,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
    unitWeightG: null,
    glycemicGrade: null,
    weightLossGrade: null,
    gradesReason: null,
    estimatedFields: [],
    source: 'manual',
    photoId: null,
    createdBy: 'user',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

export function variant(overrides: Partial<RecipeVariant> & Pick<RecipeVariant, 'recipeId' | 'ingredients'>): RecipeVariant {
  return {
    id: `variant-${++counter}`,
    name: 'Variantă',
    servings: 1,
    createdBy: 'user',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

export function plan(overrides: Partial<MealPlan> & Pick<MealPlan, 'meals'>): MealPlan {
  return {
    id: `plan-${++counter}`,
    name: 'Plan',
    createdBy: 'user',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

export function journalEntry(overrides: Partial<JournalEntry> & Pick<JournalEntry, 'date' | 'kcal'>): JournalEntry {
  return {
    id: `entry-${++counter}`,
    mealLabel: 'Prânz',
    mealItemId: null,
    kind: 'food',
    variantId: null,
    servings: null,
    foodId: null,
    grams: 100,
    name: 'Aliment',
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sodiumMg: 0,
    userId: 'user',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  }
}

export function weightEntry(date: string, weightKg: number): WeightEntry {
  return {
    id: `weight-${++counter}`,
    date,
    weightKg,
    userId: 'user',
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    deletedAt: null,
    version: 1,
  }
}
