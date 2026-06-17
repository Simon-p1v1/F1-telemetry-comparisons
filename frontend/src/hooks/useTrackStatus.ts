import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useTrackStatus(year: number, event: string, session: string) {
  return useQuery({
    queryKey: ['trackStatus', year, event, session],
    queryFn: () => api.trackStatus(year, event, session),
    enabled: !!(year && event && session),
    staleTime: Infinity,
  })
}
