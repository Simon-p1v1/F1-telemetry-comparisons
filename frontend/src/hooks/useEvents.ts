import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useEvents(year: number) {
  return useQuery({
    queryKey: ['events', year],
    queryFn: () => api.events(year),
    staleTime: Infinity,
  })
}
