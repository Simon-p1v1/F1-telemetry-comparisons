import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useWeather(year: number, event: string, session: string) {
  return useQuery({
    queryKey: ['weather', year, event, session],
    queryFn: () => api.weather(year, event, session),
    enabled: !!(year && event && session),
    staleTime: Infinity,
  })
}
