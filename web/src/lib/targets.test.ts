import { describe, expect, it } from 'vitest'
import { basalMetabolicRate, computeTargets } from './targets'

describe('computeTargets', () => {
  const inputs = { sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 85, activityLevel: 'moderate', goal: 'lose' } as const

  it('uses Mifflin-St Jeor for the basal metabolic rate', () => {
    expect(basalMetabolicRate(inputs, 2026)).toBe(10 * 85 + 6.25 * 180 - 5 * 30 + 5)
  })

  it('applies activity and a 20% deficit when losing weight', () => {
    const bmr = 10 * 85 + 6.25 * 180 - 5 * 30 + 5
    expect(computeTargets(inputs, 2026).kcal).toBe(Math.round((bmr * 1.55 * 0.8) / 10) * 10)
  })

  it('splits the calories into protein, fat and the rest as carbohydrates', () => {
    const t = computeTargets(inputs, 2026)
    expect(t.proteinG).toBe(170)
    expect(t.fatG).toBe(68)
    expect(t.proteinG * 4 + t.fatG * 9 + t.carbsG * 4).toBeCloseTo(t.kcal, -1)
    expect(t.fiberG).toBe(Math.round((t.kcal / 1000) * 14))
  })

  it('uses -161 for women', () => {
    const female = { ...inputs, sex: 'female' } as const
    expect(basalMetabolicRate(female, 2026)).toBe(basalMetabolicRate(inputs, 2026) - 166)
  })
})
