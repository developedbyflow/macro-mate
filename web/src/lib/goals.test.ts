import { describe, expect, it } from 'vitest'
import type { UserProfile } from '@/api/types'
import { goalProgress, weeklyRate } from './goals'
import { weightEntry } from './test-data'

const profile = {
  goal: 'lose',
  weightKg: 85,
  goalWeightKg: 75,
  weeklyRateKg: 0.5,
  goalStartWeightKg: 85,
  goalStartDate: '2026-09-06',
} as UserProfile

const entries = [weightEntry('2026-09-06', 85), weightEntry('2026-09-20', 84), weightEntry('2026-10-04', 83)]

describe('goalProgress', () => {
  it('measures how far you got from the start towards the goal', () => {
    const progress = goalProgress(profile, entries, '2026-10-04')!
    expect(progress.done).toBeCloseTo(2)
    expect(progress.remaining).toBeCloseTo(8)
    expect(progress.fraction).toBeCloseTo(0.2)
    expect(progress.reached).toBe(false)
  })

  it('estimates the end date from the planned rate', () => {
    expect(goalProgress(profile, entries, '2026-10-04')!.plannedEnd).toBe('2027-01-24')
  })

  it('has no goal while maintaining', () => {
    expect(goalProgress({ ...profile, goal: 'maintain' }, entries, '2026-10-04')).toBeNull()
  })

  it('works the same way when gaining', () => {
    const gain = { ...profile, goal: 'gain', goalWeightKg: 90 } as UserProfile
    expect(goalProgress(gain, entries, '2026-10-04')!.done).toBeCloseTo(-2)
  })
})

describe('weeklyRate', () => {
  it('compares the 7-day averages over the last four weeks', () => {
    expect(weeklyRate(entries, '2026-10-04', '2026-09-06', -1)).toBeCloseTo(0.5)
  })

  it('needs at least two weeks of data', () => {
    expect(weeklyRate(entries, '2026-10-04', '2026-09-27', -1)).toBeNull()
  })
})
