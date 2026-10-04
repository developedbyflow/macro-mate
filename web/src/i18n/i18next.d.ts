import 'i18next'
import type { ro } from './ro'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof ro }
  }
}
