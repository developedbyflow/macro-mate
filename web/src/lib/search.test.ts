import { describe, expect, it } from 'vitest'
import { search, searchScore } from './search'

describe('search', () => {
  it('ignores diacritics', () => {
    expect(searchScore('branza', 'Brânză de vaci')).toBeGreaterThan(0)
    expect(searchScore('capsuni', 'Căpșuni')).toBeGreaterThan(0)
  })

  it('tolerates one typo in longer words', () => {
    expect(searchScore('bnana', 'Banană')).toBeGreaterThan(0)
  })

  it('needs every word to match', () => {
    expect(searchScore('piept curcan', 'Piept de pui')).toBe(0)
  })

  it('puts word starts before matches in the middle', () => {
    const names = ['Cartofi dulci', 'Ulei', 'Dulciuri']
    expect(search(names, 'dulc', (n) => n)[0]).toBe('Cartofi dulci')
  })
})
