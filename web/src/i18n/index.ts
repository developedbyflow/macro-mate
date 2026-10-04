import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { ro } from './ro'

export const languages = ['ro', 'en'] as const
export type Language = (typeof languages)[number]

export const languageNames: Record<Language, string> = { ro: 'Română', en: 'English' }

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ro: { translation: ro }, en: { translation: en } },
    supportedLngs: languages,
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], lookupLocalStorage: 'macromate.language', caches: ['localStorage'] },
    initAsync: false,
  })

export function currentLanguage(): Language {
  return i18n.resolvedLanguage === 'ro' ? 'ro' : 'en'
}

export function locale() {
  return currentLanguage() === 'ro' ? 'ro-RO' : 'en-GB'
}

export function setLanguage(language: Language) {
  return i18n.changeLanguage(language)
}

export default i18n
