import type { UserProfile, WeightEntry } from '@/api/types'
import { addDays, daysBetween } from './dates'
import { weightSeries } from './progress'

export type GoalProgress = {
  start: number
  current: number
  goal: number
  done: number
  total: number
  fraction: number
  remaining: number
  plannedRate: number
  actualRate: number | null
  plannedEnd: string | null
  actualEnd: string | null
  reached: boolean
}

export function currentWeight(entries: WeightEntry[], day: string) {
  return weightSeries(entries, [day]).average[0] ?? entries.at(-1)?.weightKg ?? null
}

export function weeklyRate(entries: WeightEntry[], day: string, startDate: string | null, direction: number) {
  const fourWeeksAgo = addDays(day, -28)
  const from = startDate && startDate > fourWeeksAgo ? startDate : fourWeeksAgo
  const days = daysBetween(from, day)
  if (days < 14) return null
  const [then, now] = weightSeries(entries, [from, day]).average
  if (then == null || now == null) return null
  return ((now - then) * direction) / (days / 7)
}

export function goalProgress(profile: UserProfile, entries: WeightEntry[], day: string): GoalProgress | null {
  const goal = profile.goalWeightKg
  const start = profile.goalStartWeightKg ?? profile.weightKg
  if (goal == null || start == null || profile.goal === 'maintain' || goal === start) return null

  const current = currentWeight(entries, day) ?? start
  const direction = goal < start ? -1 : 1
  const total = Math.abs(goal - start)
  const done = (current - start) * direction
  const remaining = Math.max(0, total - done)
  const plannedRate = profile.weeklyRateKg ?? 0
  const actualRate = weeklyRate(entries, day, profile.goalStartDate, direction)
  const endAt = (rate: number | null) => (remaining > 0 && rate != null && rate > 0 ? addDays(day, Math.ceil((remaining / rate) * 7)) : null)

  return {
    start,
    current,
    goal,
    done,
    total,
    fraction: Math.min(1, Math.max(0, done / total)),
    remaining,
    plannedRate,
    actualRate,
    plannedEnd: endAt(plannedRate),
    actualEnd: endAt(actualRate),
    reached: done >= total,
  }
}
