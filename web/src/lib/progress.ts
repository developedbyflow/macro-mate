import type { JournalEntry, WeightEntry } from '@/api/types'
import { addDays } from './dates'
import { entryNutrients } from './journal'
import { forGrams, sum, type FoodsById, type Nutrients, type VariantsById } from './nutrition'
import type { Target } from './targets'
import { foodName } from './food-name'

export type DayTotal = { date: string; n: Nutrients | null }

export function dateRange(to: string, days: number) {
  return Array.from({ length: days }, (_, i) => addDays(to, i - days + 1))
}

export function dailyTotals(entries: JournalEntry[], dates: string[]): DayTotal[] {
  const byDate = new Map<string, Nutrients[]>()
  for (const entry of entries) byDate.set(entry.date, [...(byDate.get(entry.date) ?? []), entryNutrients(entry)])
  return dates.map((date) => {
    const day = byDate.get(date)
    return { date, n: day ? sum(day) : null }
  })
}

export function summarize(days: DayTotal[], target: Target | null) {
  const logged = days.filter((d): d is { date: string; n: Nutrients } => d.n != null)
  if (logged.length === 0) return null
  const average = sum(logged.map((d) => d.n))
  const avg: Nutrients = {
    kcal: average.kcal / logged.length,
    proteinG: average.proteinG / logged.length,
    carbsG: average.carbsG / logged.length,
    fatG: average.fatG / logged.length,
    fiberG: average.fiberG / logged.length,
    sodiumMg: average.sodiumMg / logged.length,
  }
  const highest = logged.reduce((a, b) => (b.n.kcal > a.n.kcal ? b : a))
  const lowest = logged.reduce((a, b) => (b.n.kcal < a.n.kcal ? b : a))
  const inTarget = target ? logged.filter((d) => Math.abs(d.n.kcal - target.kcal) <= target.kcal * 0.1).length : null
  const proteinDays = target?.proteinG ? logged.filter((d) => d.n.proteinG >= target.proteinG! * 0.95).length : null
  return { logged: logged.length, avg, highest, lowest, inTarget, proteinDays }
}

export function streak(loggedDates: Set<string>, today: string) {
  let day = loggedDates.has(today) ? today : addDays(today, -1)
  let count = 0
  while (loggedDates.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}

export function weightSeries(entries: WeightEntry[], dates: string[]) {
  const byDate = new Map(entries.map((e) => [e.date, e.weightKg]))
  const average = dates.map((date) => {
    const window = dateRange(date, 7)
      .map((d) => byDate.get(d))
      .filter((w): w is number => w != null)
    return window.length ? window.reduce((a, b) => a + b) / window.length : null
  })
  return { points: dates.map((d) => byDate.get(d) ?? null), average }
}

export type GlycemicShare = { A: number; B: number; C: number; unknown: number; topC: { name: string; carbsG: number }[] }

export function carbsByGlycemicGrade(entries: JournalEntry[], foods: FoodsById, variants: VariantsById): GlycemicShare {
  const share = { A: 0, B: 0, C: 0, unknown: 0 }
  const fromC = new Map<string, number>()

  function add(foodId: string | null | undefined, carbsG: number, fallbackName: string) {
    const food = foodId ? foods.get(foodId) : undefined
    const grade = food?.glycemicGrade
    const key = grade === 'A' || grade === 'B' || grade === 'C' ? grade : 'unknown'
    share[key] += carbsG
    if (key === 'C') {
      const name = foodName(food) ?? fallbackName
      fromC.set(name, (fromC.get(name) ?? 0) + carbsG)
    }
  }

  for (const entry of entries) {
    const variant = entry.kind === 'variant' && entry.variantId ? variants.get(entry.variantId) : undefined
    if (!variant) {
      add(entry.foodId, entry.carbsG, entry.name)
      continue
    }
    const factor = (entry.servings ?? 1) / Math.max(1, variant.servings)
    for (const ingredient of variant.ingredients) {
      const food = foods.get(ingredient.foodId)
      if (food) add(food.id, forGrams(food, ingredient.grams).carbsG * factor, foodName(food))
    }
  }

  const topC = [...fromC]
    .map(([name, carbsG]) => ({ name, carbsG }))
    .sort((a, b) => b.carbsG - a.carbsG)
    .slice(0, 3)
  return { ...share, topC }
}
