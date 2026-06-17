import type { Event, Result, Lap, TelemetryPoint, WeatherData, TrackStatus, Corner } from '../types/api'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(detail?.detail ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  events: (year: number) =>
    get<Event[]>(`/events/${year}`),

  results: (year: number, event: string, session: string) =>
    get<Result[]>(`/sessions/${year}/${encodeURIComponent(event)}/${session}/results`),

  laps: (year: number, event: string, session: string, driver?: string) =>
    get<Lap[]>(
      `/sessions/${year}/${encodeURIComponent(event)}/${session}/laps${driver ? `?driver=${driver}` : ''}`
    ),

  telemetry: (year: number, event: string, session: string, driver: string, lap: number) =>
    get<TelemetryPoint[]>(
      `/sessions/${year}/${encodeURIComponent(event)}/${session}/telemetry/${driver}/${lap}`
    ),

  weather: (year: number, event: string, session: string) =>
    get<WeatherData[]>(`/sessions/${year}/${encodeURIComponent(event)}/${session}/weather`),

  trackStatus: (year: number, event: string, session: string) =>
    get<TrackStatus[]>(`/sessions/${year}/${encodeURIComponent(event)}/${session}/track_status`),

  corners: (year: number, event: string, session: string) =>
    get<Corner[]>(`/sessions/${year}/${encodeURIComponent(event)}/${session}/corners`),
}
