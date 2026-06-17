import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export function useTelemetry(
  year: number,
  event: string,
  session: string,
  driver: string,
  lapNumber: number | null,
) {
  return useQuery({
    queryKey: ['telemetry', year, event, session, driver, lapNumber],
    queryFn: () => api.telemetry(year, event, session, driver, lapNumber!),
    enabled: !!(year && event && session && driver && lapNumber),
    staleTime: Infinity,
  })
}
