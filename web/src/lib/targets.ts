import type { UserProfile } from '@/api/types'
import type { Nutrients } from './nutrition'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active'
export type Goal = 'lose' | 'maintain' | 'gain'

export const activityLevels: Record<ActivityLevel, { label: string; factor: number }> = {
  sedentary: { label: 'Sedentar (birou, fără sport)', factor: 1.2 },
  light: { label: 'Ușor activ (sport 1–3 ori pe săptămână)', factor: 1.375 },
  moderate: { label: 'Moderat (sport 3–5 ori pe săptămână)', factor: 1.55 },
  very_active: { label: 'Foarte activ (sport zilnic sau muncă fizică)', factor: 1.725 },
}

export const goals: Record<Goal, { label: string; factor: number }> = {
  lose: { label: 'Slăbire', factor: 0.8 },
  maintain: { label: 'Menținere', factor: 1 },
  gain: { label: 'Masă musculară', factor: 1.1 },
}

export type TargetInputs = {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
}

export function basalMetabolicRate({ sex, birthYear, heightCm, weightKg }: TargetInputs, year: number) {
  const age = year - birthYear
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function computeTargets(inputs: TargetInputs, year = new Date().getFullYear()): Nutrients {
  const bmr = basalMetabolicRate(inputs, year)
  const kcal = Math.round((bmr * activityLevels[inputs.activityLevel].factor * goals[inputs.goal].factor) / 10) * 10
  const proteinG = Math.round(inputs.weightKg * (inputs.goal === 'lose' ? 2 : 1.6))
  const fatG = Math.round(inputs.weightKg * 0.8)
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
  const fiberG = Math.round((kcal / 1000) * 14)
  return { kcal, proteinG, carbsG, fatG, fiberG, sodiumMg: 2300 }
}

export type Target = Partial<Nutrients> & { kcal: number }

export function targetFromProfile(profile: UserProfile | undefined): Target | null {
  if (!profile?.targetKcal) return null
  return {
    kcal: profile.targetKcal,
    proteinG: profile.targetProteinG ?? undefined,
    carbsG: profile.targetCarbsG ?? undefined,
    fatG: profile.targetFatG ?? undefined,
    fiberG: profile.targetFiberG ?? undefined,
    sodiumMg: profile.targetSodiumMg ?? undefined,
  }
}

export function targetsForWeight(profile: UserProfile, weightKg: number): Nutrients | null {
  const { sex, birthYear, heightCm, activityLevel, goal } = profile
  if (!sex || !birthYear || !heightCm || !activityLevel || !goal) return null
  return computeTargets({ sex: sex as Sex, birthYear, heightCm, weightKg, activityLevel: activityLevel as ActivityLevel, goal: goal as Goal })
}
