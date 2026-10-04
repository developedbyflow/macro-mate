import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useOnline } from './use-online'

export function useAiStatus() {
  const online = useOnline()
  const query = useQuery({ queryKey: ['ai-status'], queryFn: api.aiStatus, enabled: online, staleTime: 5 * 60_000 })
  return { online, configured: query.data?.configured ?? false }
}
