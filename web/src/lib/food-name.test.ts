import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { foodName, foodSearchText } from './food-name'

const blueberries = { name: 'Afine', nameEn: 'Blueberries', brand: null }
const telemea = { name: 'Telemea', nameEn: null, brand: 'Napolact' }

describe('foodName', () => {
  afterEach(() => i18n.changeLanguage('ro'))

  it('shows the Romanian name in Romanian', () => {
    expect(foodName(blueberries)).toBe('Afine')
  })

  it('shows the English name in English, and the Romanian one when there is no English name', async () => {
    await i18n.changeLanguage('en')
    expect(foodName(blueberries)).toBe('Blueberries')
    expect(foodName(telemea)).toBe('Telemea')
  })

  it('searches in both names and the brand', () => {
    expect(foodSearchText(blueberries)).toBe('Afine Blueberries')
    expect(foodSearchText(telemea)).toBe('Telemea Napolact')
  })
})
