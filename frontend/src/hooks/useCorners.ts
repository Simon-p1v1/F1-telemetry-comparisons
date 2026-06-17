import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useCorners(year: number, event: string, session: string) {
  return useQuery({
    queryKey: ['corners', year, event, session],
    queryFn: () => api.corners(year, event, session),
    enabled: !!(year && event && session),
    staleTime: Infinity,
  })
}
