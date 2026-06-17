import { useMemo } from 'react'
import { useTrackStatus } from '../../hooks/useTrackStatus'
import type { Lap } from '../../types/api'

interface TrackStatusChartProps {
  year: number
  event: string
  session: string
  laps: Lap[]
  maxLap?: number
}

const STATUS_COLORS: Record<string, string> = {
  '1': '#22c55e',  // Green flag
  '2': '#eab308',  // Yellow flag
  '4': '#f97316',  // Safety Car
  '5': '#ef4444',  // Red flag
  '6': '#3b82f6',  // VSC deployed
  '7': '#93c5fd',  // VSC ending
}

const STATUS_LABELS: Record<string, string> = {
  '1': 'Green',
  '2': 'Yellow',
  '4': 'Safety Car',
  '5': 'Red Flag',
  '6': 'VSC',
  '7': 'VSC Ending',
}

const LEGEND_ITEMS = [
  { status: '1', label: 'Green' },
  { status: '2', label: 'Yellow' },
  { status: '4', label: 'SC' },
  { status: '5', label: 'Red' },
  { status: '6', label: 'VSC' },
  { status: '7', label: 'VSC End' },
]

export default function TrackStatusChart({ year, event, session, laps, maxLap }: TrackStatusChartProps) {
  const { data: trackStatus, isLoading, isError } = useTrackStatus(year, event, session)

  // Build cumulative lap time boundaries (same approach as WeatherChart)
  const lapBoundaries = useMemo(() => {
    if (!laps.length) return []
    const driverLapCounts: Record<string, number> = {}
    laps.forEach((l) => { driverLapCounts[l.Driver] = (driverLapCounts[l.Driver] ?? 0) + 1 })
    const refDriver = Object.entries(driverLapCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!refDriver) return []

    const refLaps = laps
      .filter((l) => l.Driver === refDriver && l.LapTime !== null)
      .sort((a, b) => a.LapNumber - b.LapNumber)

    let sessionOffset = 0
    const isValidTime = (v: unknown): v is number => typeof v === 'number' && !isNaN(v) && v > 0
    const firstLapWithPit = refLaps.find((l) => isValidTime(l.PitOutTime))
    if (firstLapWithPit && isValidTime(firstLapWithPit.PitOutTime)) {
      let cumBefore = 0
      for (const l of refLaps) {
        if (l.LapNumber >= firstLapWithPit.LapNumber) break
        cumBefore += l.LapTime ?? 0
      }
      sessionOffset = firstLapWithPit.PitOutTime - cumBefore
    } else {
      // Fall back to first Green-flag time — that's when the race actually starts
      const firstGreen = trackStatus?.find((t) => t.Status === '1')
      sessionOffset = firstGreen?.Time ?? 0
    }

    let cum = sessionOffset
    return refLaps.map((l) => {
      const start = cum
      cum += l.LapTime ?? 0
      return { lap: l.LapNumber, start, end: cum }
    })
  }, [laps, trackStatus])

  // For each lap, get the status active at lap start
  const lapStatusData = useMemo(() => {
    if (!trackStatus?.length || !lapBoundaries.length) return []

    return lapBoundaries.map(({ lap, start }) => {
      // Status at lap start = last change at or before start time
      const before = trackStatus.filter((t) => (t.Time ?? 0) <= start)
      const status = before.length ? before[before.length - 1].Status : '1'
      return { lap, status }
    })
  }, [trackStatus, lapBoundaries])

  const activeLegendStatuses = useMemo(
    () => new Set(lapStatusData.map((d) => d.status)),
    [lapStatusData],
  )

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 text-[10px] text-muted">
        <div className="w-3 h-3 border border-f1red border-t-transparent rounded-full animate-spin" />
        Loading track status…
      </div>
    )
  }
  if (isError) return <div className="text-[10px] text-red-400 py-1">Failed to load track status</div>
  if (!lapStatusData.length) return <div className="text-[10px] text-muted py-1">No track status data</div>

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-1 px-1 flex-wrap">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Track Status</span>
        <div className="flex items-center gap-2 flex-wrap">
          {LEGEND_ITEMS.filter((item) => activeLegendStatuses.has(item.status)).map((item) => (
            <div key={item.status} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[item.status] }} />
              <span className="text-[9px] text-muted">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Colored strip — left margin matches recharts YAxis width (36px) + padding */}
      <div className="flex items-stretch rounded overflow-hidden" style={{ height: 18, marginLeft: 36, marginRight: 8 }}>
        {lapStatusData.map(({ lap, status }) => (
          <div
            key={lap}
            className="flex-1 relative group"
            style={{ backgroundColor: STATUS_COLORS[status] ?? '#444', minWidth: 0 }}
            title={`Lap ${lap}: ${STATUS_LABELS[status] ?? status}`}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10
              bg-panel border border-border rounded px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap pointer-events-none">
              L{lap} · {STATUS_LABELS[status] ?? status}
            </div>
          </div>
        ))}
      </div>

      {/* Lap number axis */}
      <div className="flex items-center text-[8px] text-muted font-mono mt-0.5" style={{ marginLeft: 36, marginRight: 8 }}>
        {lapStatusData
          .filter((_, i) => i === 0 || (i + 1) % Math.ceil(lapStatusData.length / 10) === 0)
          .map(({ lap }) => (
            <div key={lap} className="flex-1 text-center" style={{ minWidth: 0 }}>
              {lap}
            </div>
          ))}
      </div>
    </div>
  )
}
