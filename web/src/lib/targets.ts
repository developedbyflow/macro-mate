import type { UserProfile } from '@/api/types'
import i18n from '@/i18n'
import type { Nutrients } from './nutrition'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active'
export type Goal = 'lose' | 'maintain' | 'gain'

function activity(level: ActivityLevel, factor: number) {
  return {
    factor,
    get label() {
      return i18n.t(`targets.activity.${level}`)
    },
  }
}

function goal(name: Goal, rates: number[], defaultRate: number) {
  return {
    rates,
    defaultRate,
    get label() {
      return i18n.t(`targets.goal.${name}`)
    },
  }
}

export const activityLevels: Record<ActivityLevel, { label: string; factor: number }> = {
  sedentary: activity('sedentary', 1.2),
  light: activity('light', 1.375),
  moderate: activity('moderate', 1.55),
  very_active: activity('very_active', 1.725),
}

export const goals: Record<Goal, { label: string; rates: number[]; defaultRate: number }> = {
  lose: goal('lose', [0.25, 0.5, 0.75, 1], 0.5),
  maintain: goal('maintain', [], 0),
  gain: goal('gain', [0.25, 0.5], 0.25),
}

export const kcalPerKg = 7700

export type TargetInputs = {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goal: Goal
  weeklyRateKg?: number | null
}

export function basalMetabolicRate({ sex, birthYear, heightCm, weightKg }: TargetInputs, year: number) {
  const age = year - birthYear
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161)
}

export function energyPlan(inputs: TargetInputs, year = new Date().getFullYear()) {
  const bmr = basalMetabolicRate(inputs, year)
  const tdee = bmr * activityLevels[inputs.activityLevel].factor
  const rate = inputs.goal === 'maintain' ? 0 : (inputs.weeklyRateKg ?? goals[inputs.goal].defaultRate)
  const dailyChange = ((rate * kcalPerKg) / 7) * (inputs.goal === 'lose' ? -1 : 1)
  const wanted = tdee + dailyChange
  return { bmr, tdee, rate, dailyChange, kcal: Math.round(Math.max(wanted, bmr) / 10) * 10, limitedByBmr: wanted < bmr }
}

export function computeTargets(inputs: TargetInputs, year = new Date().getFullYear()): Nutrients {
  const { kcal } = energyPlan(inputs, year)
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

export function maintenanceKcal(profile: UserProfile, weightKg: number) {
  const { sex, birthYear, heightCm, activityLevel } = profile
  if (!sex || !birthYear || !heightCm || !activityLevel) return null
  return energyPlan({ sex: sex as Sex, birthYear, heightCm, weightKg, activityLevel: activityLevel as ActivityLevel, goal: 'maintain' }).tdee
}

export function projectedWeight(weightKg: number, dayKcal: number, maintenance: number, days = 28) {
  return weightKg + ((dayKcal - maintenance) * days) / kcalPerKg
}

export function targetsForWeight(profile: UserProfile, weightKg: number): Nutrients | null {
  const { sex, birthYear, heightCm, activityLevel, goal, weeklyRateKg } = profile
  if (!sex || !birthYear || !heightCm || !activityLevel || !goal) return null
  return computeTargets({ sex: sex as Sex, birthYear, heightCm, weightKg, activityLevel: activityLevel as ActivityLevel, goal: goal as Goal, weeklyRateKg })
}
