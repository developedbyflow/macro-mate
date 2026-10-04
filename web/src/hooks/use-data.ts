import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { DayPlan, Food, JournalEntry, MealPlan, MeResponse, Recipe, RecipeVariant, ShoppingList, UserProfile, WeightEntry } from '@/api/types'
import { db } from '@/db/database'
import type { Exclusions } from '@/lib/nutrition'
import { foodName } from '@/lib/food-name'
import { locale } from '@/i18n'

function alive<T extends { deletedAt: string | null }>(rows: T[]) {
  return rows.filter((row) => row.deletedAt == null)
}

const empty: never[] = []

export function useMe() {
  return useLiveQuery(async () => (await db.meta.get('me'))?.value as MeResponse | undefined)
}

export function useKitchenId() {
  return useLiveQuery(async () => ((await db.meta.get('kitchenId'))?.value as string | undefined) ?? null)
}

export function canEditFood(food: Food, kitchenId: string | null | undefined, isAdmin: boolean) {
  return food.kitchenId == null ? isAdmin : food.kitchenId === kitchenId
}

export function useCanEditFood(food: Food | undefined) {
  const me = useMe()
  const kitchenId = useKitchenId()
  return food != null && canEditFood(food, kitchenId, me?.isAdmin ?? false)
}

export function useFoods(): Food[] {
  return useLiveQuery(async () => alive(await db.foods.toArray()).sort((a, b) => foodName(a).localeCompare(foodName(b), locale()))) ?? empty
}

export function useFood(id: string) {
  return useLiveQuery(() => db.foods.get(id), [id])
}

export function useFoodsById() {
  const foods = useLiveQuery(() => db.foods.toArray()) ?? empty
  return useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
}

export function useRecipes(): Recipe[] {
  return useLiveQuery(async () => alive(await db.recipes.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'ro'))) ?? empty
}

export function useRecipe(id: string) {
  return useLiveQuery(() => db.recipes.get(id), [id])
}

export function useRecipesById() {
  const recipes = useLiveQuery(() => db.recipes.toArray()) ?? empty
  return useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
}

export function useVariants(): RecipeVariant[] {
  return useLiveQuery(async () => alive(await db.recipeVariants.toArray())) ?? empty
}

export function useVariantsById() {
  const variants = useLiveQuery(() => db.recipeVariants.toArray()) ?? empty
  return useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])
}

export function useRecipeVariants(recipeId: string): RecipeVariant[] {
  return (
    useLiveQuery(async () => alive(await db.recipeVariants.where('recipeId').equals(recipeId).toArray()), [recipeId]) ?? empty
  )
}

export function useVariant(id: string) {
  return useLiveQuery(() => db.recipeVariants.get(id), [id])
}

export function useMealPlans(): MealPlan[] {
  return useLiveQuery(async () => alive(await db.mealPlans.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'ro'))) ?? empty
}

export function useMealPlan(id: string) {
  return useLiveQuery(() => db.mealPlans.get(id), [id])
}

export function useMealPlansById() {
  const plans = useLiveQuery(() => db.mealPlans.toArray()) ?? empty
  return useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans])
}

export function useShoppingLists(): ShoppingList[] {
  return useLiveQuery(async () => alive(await db.shoppingLists.toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) ?? empty
}

export function useShoppingList(id: string) {
  return useLiveQuery(() => db.shoppingLists.get(id), [id])
}

export function useProfile(): UserProfile | undefined {
  return useLiveQuery(async () => {
    const me = (await db.meta.get('me'))?.value as { id: string } | undefined
    if (!me) return undefined
    return db.userProfiles.where('userId').equals(me.id).first()
  })
}

export function useExclusions(): Exclusions {
  const profile = useProfile()
  return useMemo(
    () => ({
      foodIds: new Set(profile?.excludedFoodIds ?? []),
      categories: new Set(profile?.excludedCategories ?? []),
    }),
    [profile],
  )
}

export function useUsersById() {
  const users = useLiveQuery(() => db.users.toArray()) ?? empty
  return useMemo(() => new Map(users.map((u) => [u.id, u.displayName])), [users])
}

export function useDayPlan(date: string): DayPlan | undefined {
  return useLiveQuery(async () => {
    const plans = alive(await db.dayPlans.where('date').equals(date).toArray())
    return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  }, [date])
}

export function useJournal(date: string): JournalEntry[] {
  return (
    useLiveQuery(async () => alive(await db.journalEntries.where('date').equals(date).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [date]) ??
    empty
  )
}

export function useJournalBetween(from: string, to: string): JournalEntry[] {
  return useLiveQuery(async () => alive(await db.journalEntries.where('date').between(from, to, true, true).toArray()), [from, to]) ?? empty
}

export function usePantryFoodIds(): Set<string> {
  const items = useLiveQuery(async () => alive(await db.pantryItems.toArray())) ?? empty
  return useMemo(() => new Set(items.map((item) => item.foodId)), [items])
}

export function useWeightEntries(): WeightEntry[] {
  return useLiveQuery(async () => alive(await db.weightEntries.orderBy('date').toArray())) ?? empty
}

export function useRecentFoodIds(): string[] {
  return useLiveQuery(async () => ((await db.meta.get('recentFoods'))?.value as string[] | undefined) ?? []) ?? empty
}

export async function rememberRecentFood(foodId: string) {
  const current = ((await db.meta.get('recentFoods'))?.value as string[] | undefined) ?? []
  await db.meta.put({ key: 'recentFoods', value: [foodId, ...current.filter((id) => id !== foodId)].slice(0, 30) })
}

export function useOutboxCount() {
  return useLiveQuery(() => db.outbox.count()) ?? 0
}
