import { describe, expect, it } from 'vitest'
import { carbsByGlycemicGrade, dailyTotals, dateRange, streak, summarize, weightSeries } from './progress'
import { food, journalEntry, variant, weightEntry } from './test-data'

const target = { kcal: 2000, proteinG: 150 }

describe('summarize', () => {
  const dates = dateRange('2026-10-04', 4)
  const entries = [
    journalEntry({ date: '2026-10-01', kcal: 1500, proteinG: 100 }),
    journalEntry({ date: '2026-10-01', kcal: 400, proteinG: 50 }),
    journalEntry({ date: '2026-10-03', kcal: 2500, proteinG: 160 }),
    journalEntry({ date: '2026-10-04', kcal: 2050, proteinG: 120 }),
  ]

  it('adds the entries of a day and leaves days without entries empty', () => {
    const days = dailyTotals(entries, dates)
    expect(days.map((d) => d.n?.kcal ?? null)).toEqual([1900, null, 2500, 2050])
  })

  it('averages only the days that were logged', () => {
    const result = summarize(dailyTotals(entries, dates), target)!
    expect(result.logged).toBe(3)
    expect(result.avg.kcal).toBeCloseTo((1900 + 2500 + 2050) / 3)
    expect(result.highest.date).toBe('2026-10-03')
    expect(result.lowest.date).toBe('2026-10-01')
  })

  it('counts a day in target when it is within 10% of the calories', () => {
    const result = summarize(dailyTotals(entries, dates), target)!
    expect(result.inTarget).toBe(2)
    expect(result.proteinDays).toBe(2)
  })

  it('returns nothing when no day was logged', () => {
    expect(summarize(dailyTotals([], dates), target)).toBeNull()
  })
})

describe('streak', () => {
  it('counts the days in a row up to today', () => {
    expect(streak(new Set(['2026-10-02', '2026-10-03', '2026-10-04']), '2026-10-04')).toBe(3)
  })

  it('still counts from yesterday when today has nothing yet', () => {
    expect(streak(new Set(['2026-10-02', '2026-10-03']), '2026-10-04')).toBe(2)
  })
})

describe('weightSeries', () => {
  it('averages the weigh-ins of the last 7 days for each day', () => {
    const entries = [weightEntry('2026-09-28', 85), weightEntry('2026-10-01', 84), weightEntry('2026-10-05', 83)]
    const { points, average } = weightSeries(entries, ['2026-10-01', '2026-10-05'])
    expect(points).toEqual([84, 83])
    expect(average[0]).toBeCloseTo(84.5)
    expect(average[1]).toBeCloseTo(83.5)
  })
})

describe('carbsByGlycemicGrade', () => {
  const bread = food({ name: 'Pâine albă', category: 'bread_bakery', kcal: 265, carbsG: 49, glycemicGrade: 'C' })
  const apple = food({ name: 'Măr', category: 'fruits', kcal: 52, carbsG: 14, glycemicGrade: 'A' })
  const foods = new Map([bread, apple].map((f) => [f.id, f]))

  it('splits a recipe into its ingredients', () => {
    const sandwich = variant({ recipeId: 'r', servings: 2, ingredients: [{ foodId: bread.id, grams: 200 }, { foodId: apple.id, grams: 100 }] })
    const variants = new Map([[sandwich.id, sandwich]])
    const entry = journalEntry({ date: '2026-10-04', kcal: 300, kind: 'variant', variantId: sandwich.id, servings: 1 })

    const share = carbsByGlycemicGrade([entry], foods, variants)

    expect(share.C).toBeCloseTo(49)
    expect(share.A).toBeCloseTo(7)
    expect(share.topC).toEqual([{ name: 'Pâine albă', carbsG: 49 }])
  })

  it('uses the carbohydrates saved in the journal for a food', () => {
    const entry = journalEntry({ date: '2026-10-04', kcal: 52, foodId: apple.id, carbsG: 14 })
    expect(carbsByGlycemicGrade([entry], foods, new Map()).A).toBe(14)
  })
})
