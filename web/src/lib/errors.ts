import { ApiError, OfflineError } from '@/api/client'
import i18n from '@/i18n'

export function errorText(error: unknown) {
  if (!error) return null
  if (error instanceof OfflineError) return i18n.t('errors.offline')
  if (error instanceof ApiError) return error.message
  return i18n.t('auth.somethingWrong')
}
