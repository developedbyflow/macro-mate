import { describe, expect, it } from 'vitest'
import { recipeSteps } from './recipes'

describe('recipeSteps', () => {
  it('drops the numbers and bullets DeepSeek sometimes adds', () => {
    expect(recipeSteps('1. Fierbe orezul.\n2) Taie puiul.\n\n- Servește.')).toEqual(['Fierbe orezul.', 'Taie puiul.', 'Servește.'])
  })

  it('keeps numbers that are part of the step', () => {
    expect(recipeSteps('Coace 20 de minute.\n200 g de iaurt se amestecă.')).toEqual(['Coace 20 de minute.', '200 g de iaurt se amestecă.'])
  })
})
