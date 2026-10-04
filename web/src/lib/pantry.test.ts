import { describe, expect, it } from 'vitest'
import { pantryItemId } from './pantry'

describe('pantryItemId', () => {
  it('gives the same id as the server for the same kitchen and food', async () => {
    expect(await pantryItemId('01a105e7-fd66-72a6-939c-a640a2f0e930', 'fffc4bba-70d3-382f-f018-94817a22877e')).toBe('cd9973c5-da8b-6820-e429-ea2f25f65312')
  })
})
