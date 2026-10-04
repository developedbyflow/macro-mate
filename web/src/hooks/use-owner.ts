import { useMe } from './use-data'

export function useOwnerId() {
  return useMe()?.id ?? ''
}
