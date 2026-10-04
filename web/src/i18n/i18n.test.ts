import { describe, expect, it } from 'vitest'
import { en } from './en'
import type { Messages } from './messages'
import { ro } from './ro'

const pluralSuffix = /_(zero|one|two|few|many|other)$/

function flatten(messages: Messages, prefix = '', into = new Map<string, string>()) {
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') into.set(path, value)
    else flatten(value, path, into)
  }
  return into
}

function baseKeys(messages: Map<string, string>) {
  return [...new Set([...messages.keys()].map((key) => key.replace(pluralSuffix, '')))].sort()
}

function variables(text: string) {
  return [...text.matchAll(/{{\s*(\w+)\s*}}/g)]
    .map((match) => match[1])
    .filter((name) => name !== 'count')
    .sort()
}

describe('translations', () => {
  const roMessages = flatten(ro)
  const enMessages = flatten(en)

  it('have the same keys in Romanian and English', () => {
    expect(baseKeys(enMessages)).toEqual(baseKeys(roMessages))
  })

  it('use the same variables in both languages', () => {
    for (const [key, text] of enMessages) {
      const base = key.replace(pluralSuffix, '')
      const roText = roMessages.get(key) ?? roMessages.get(`${base}_other`) ?? roMessages.get(base) ?? ''
      expect(variables(text), key).toEqual(variables(roText))
    }
  })

  it('give every plural the forms its language needs', () => {
    const forms = (messages: Map<string, string>, base: string) => [...messages.keys()].filter((key) => key.replace(pluralSuffix, '') === base && key !== base).map((key) => key.slice(base.length + 1)).sort()
    for (const base of baseKeys(roMessages)) {
      const roForms = forms(roMessages, base)
      if (roForms.length > 0) expect(roForms, base).toEqual(['few', 'one', 'other'])
      const enForms = forms(enMessages, base)
      if (enForms.length > 0) expect(enForms, base).toEqual(['one', 'other'])
    }
  })
})
