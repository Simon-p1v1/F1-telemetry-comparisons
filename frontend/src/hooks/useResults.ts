import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useResults(year: number, event: string, session: string) {
  return useQuery({
    queryKey: ['results', year, event, session],
    queryFn: () => api.results(year, event, session),
    enabled: !!(year && event && session),
    staleTime: Infinity,
  })
}
