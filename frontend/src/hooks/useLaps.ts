import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useLaps(year: number, event: string, session: string) {
  return useQuery({
    queryKey: ['laps', year, event, session],
    queryFn: () => api.laps(year, event, session),
    enabled: !!(year && event && session),
    staleTime: Infinity,
  })
}
