import type { Lap, TelemetryPoint } from '../types/api'

export function getFastestLapNumber(laps: Lap[], driver: string): number | null {
  const driverLaps = laps.filter(
    (l) => l.Driver === driver && l.LapTime !== null && l.IsAccurate !== false,
  )
  if (driverLaps.length === 0) {
    // Fallback: any lap with a time
    const anyLaps = laps.filter((l) => l.Driver === driver && l.LapTime !== null)
    if (anyLaps.length === 0) return null
    return anyLaps.reduce((best, l) => (l.LapTime! < best.LapTime! ? l : best)).LapNumber
  }
  return driverLaps.reduce((best, l) => (l.LapTime! < best.LapTime! ? l : best)).LapNumber
}

// Binary search: find index where tel[i].Distance <= dist < tel[i+1].Distance
function bisect(tel: TelemetryPoint[], dist: number): number {
  let lo = 0
  let hi = tel.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if ((tel[mid].Distance ?? 0) <= dist) lo = mid
    else hi = mid
  }
  return lo
}

export function interpolateAtDistance(
  tel: TelemetryPoint[],
  dist: number,
  field: keyof TelemetryPoint,
): number {
  if (tel.length === 0) return 0
  if (dist <= (tel[0].Distance ?? 0)) return (tel[0][field] as number) ?? 0
  if (dist >= (tel[tel.length - 1].Distance ?? 0))
    return (tel[tel.length - 1][field] as number) ?? 0

  const i = bisect(tel, dist)
  const d0 = tel[i].Distance ?? 0
  const d1 = tel[i + 1].Distance ?? 0
  const span = d1 - d0
  if (span === 0) return (tel[i][field] as number) ?? 0

  const t = (dist - d0) / span
  const v0 = (tel[i][field] as number) ?? 0
  const v1 = (tel[i + 1][field] as number) ?? 0
  return v0 + (v1 - v0) * t
}

export type ChartRow = Record<string, number>

// Merge multi-driver telemetry into a single array keyed by driver code.
// Uses the first driver's distance points as the reference axis.
export function mergeChannelData(
  telMap: Map<string, TelemetryPoint[]>,
  channel: keyof TelemetryPoint,
): ChartRow[] {
  if (telMap.size === 0) return []
  const drivers = [...telMap.keys()]
  const ref = telMap.get(drivers[0])!

  return ref
    .filter((p) => p.Distance !== null)
    .map((p) => {
      const row: ChartRow = { distance: p.Distance! }
      row[drivers[0]] = (p[channel] as number) ?? 0
      for (let i = 1; i < drivers.length; i++) {
        row[drivers[i]] = interpolateAtDistance(telMap.get(drivers[i])!, p.Distance!, channel)
      }
      return row
    })
}

// Delta in seconds: positive = ref driver is FASTER (gains time) at this point.
// delta > 0 means ref is ahead of comp by that many seconds.
export function mergeDeltaData(telMap: Map<string, TelemetryPoint[]>): ChartRow[] {
  if (telMap.size < 2) return []
  const drivers = [...telMap.keys()]
  const ref = telMap.get(drivers[0])!
  const refStart = ref[0]?.SessionTime ?? 0

  const compStarts = new Map<string, number>()
  for (let i = 1; i < drivers.length; i++) {
    const tel = telMap.get(drivers[i])!
    compStarts.set(drivers[i], tel[0]?.SessionTime ?? 0)
  }

  return ref
    .filter((p) => p.Distance !== null && p.SessionTime !== null)
    .map((p) => {
      const row: ChartRow = { distance: p.Distance! }
      const refLapTime = p.SessionTime! - refStart
      for (let i = 1; i < drivers.length; i++) {
        const d = drivers[i]
        const compST = interpolateAtDistance(telMap.get(d)!, p.Distance!, 'SessionTime')
        const compLapTime = compST - (compStarts.get(d) ?? 0)
        // positive = ref is ahead (faster so far); negative = ref is behind
        row[d] = compLapTime - refLapTime
      }
      return row
    })
}

// Sessions extracted from an event (skipping empty slots)
export function extractSessions(event: {
  Session1: string; Session2: string; Session3: string; Session4: string; Session5: string
}): { label: string; code: string }[] {
  const NAME_TO_CODE: Record<string, string> = {
    'Practice 1': 'FP1', 'FP1': 'FP1',
    'Practice 2': 'FP2', 'FP2': 'FP2',
    'Practice 3': 'FP3', 'FP3': 'FP3',
    'Qualifying': 'Q', 'Q': 'Q',
    'Sprint Qualifying': 'SQ', 'Sprint Shootout': 'SQ', 'SQ': 'SQ',
    'Sprint': 'S', 'S': 'S',
    'Race': 'R', 'R': 'R',
  }
  const sessions: { label: string; code: string }[] = []
  for (const key of ['Session1', 'Session2', 'Session3', 'Session4', 'Session5'] as const) {
    const name = event[key]
    if (name && NAME_TO_CODE[name]) {
      sessions.push({ label: name, code: NAME_TO_CODE[name] })
    }
  }
  return sessions
}
