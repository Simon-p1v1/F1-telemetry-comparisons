import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useWeather } from '../../hooks/useWeather'
import type { Lap } from '../../types/api'

interface WeatherChartProps {
  year: number
  event: string
  session: string
  laps: Lap[]
  lapDomain?: [number, number]
}

const TICK_STYLE = { fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }

export default function WeatherChart({ year, event, session, laps, lapDomain }: WeatherChartProps) {
  const { data: weather, isLoading, isError } = useWeather(year, event, session)

  // Build lap → session-time map from the reference driver (whoever has most laps)
  const lapTimes = useMemo(() => {
    if (!laps.length) return []
    // Pick the driver with the most complete laps
    const driverLapCounts: Record<string, number> = {}
    laps.forEach((l) => { driverLapCounts[l.Driver] = (driverLapCounts[l.Driver] ?? 0) + 1 })
    const refDriver = Object.entries(driverLapCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!refDriver) return []

    return laps
      .filter((l) => l.Driver === refDriver && l.LapTime !== null)
      .sort((a, b) => a.LapNumber - b.LapNumber)
  }, [laps])

  // Merge weather samples onto the lap-number axis by session time
  const chartData = useMemo(() => {
    if (!weather?.length || !lapTimes.length) return []

    // Build cumulative session time boundaries per lap.
    // We use PitOutTime of lap 1 as the session-time anchor when available,
    // otherwise we assume the session started at the first weather sample's time.
    let sessionOffset = 0
    const firstLapWithPit = lapTimes.find((l) => l.PitOutTime !== null)
    if (firstLapWithPit?.PitOutTime != null) {
      // PitOutTime is session time; subtract laps completed before it
      let cumBefore = 0
      for (const l of lapTimes) {
        if (l.LapNumber >= firstLapWithPit.LapNumber) break
        cumBefore += l.LapTime ?? 0
      }
      sessionOffset = firstLapWithPit.PitOutTime - cumBefore
    } else {
      // Fall back: assume session started at the minimum weather Time
      sessionOffset = Math.min(...weather.map((w) => w.Time ?? 0))
    }

    // Cumulative lap end times (session time when each lap finishes)
    let cum = sessionOffset
    const lapBoundaries: { lap: number; start: number; end: number }[] = []
    for (const l of lapTimes) {
      const start = cum
      cum += l.LapTime ?? 0
      lapBoundaries.push({ lap: l.LapNumber, start, end: cum })
    }

    // For each lap, find weather samples within that lap window and average them
    return lapBoundaries.map(({ lap, start, end }) => {
      const samples = weather.filter(
        (w) => w.Time !== null && w.Time >= start && w.Time < end,
      )
      if (!samples.length) {
        // Use nearest sample
        const nearest = weather.reduce((best, w) => {
          const mid = (start + end) / 2
          return Math.abs((w.Time ?? 0) - mid) < Math.abs((best.Time ?? 0) - mid) ? w : best
        })
        samples.push(nearest)
      }
      const avg = <K extends keyof typeof samples[0]>(key: K) => {
        const vals = samples.map((s) => s[key] as number | null).filter((v) => v !== null) as number[]
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }
      return {
        lap,
        AirTemp: avg('AirTemp'),
        TrackTemp: avg('TrackTemp'),
        Humidity: avg('Humidity'),
        Rainfall: samples.some((s) => (s.Rainfall ?? 0) > 0) ? 1 : 0,
      }
    })
  }, [weather, lapTimes])

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[10px] text-muted">
        <div className="w-3 h-3 border border-f1red border-t-transparent rounded-full animate-spin" />
        Loading weather…
      </div>
    )
  }
  if (isError) return <div className="text-[10px] text-red-400 py-2">Failed to load weather data</div>
  if (!chartData.length) return <div className="text-[10px] text-muted py-2">No weather data available</div>

  const hasRain = chartData.some((d) => d.Rainfall)

  return (
    <div className="w-full" style={{ height: 280 }}>
      <div className="flex items-center gap-2 mb-0.5 px-1">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Weather</span>
        <span className="text-[10px] text-muted/60">per lap</span>
        {hasRain && (
          <span className="text-[10px] text-blue-400 ml-1">🌧 rain detected</span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={262}>
        <ComposedChart data={chartData} margin={{ top: 2, right: 44, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
          <XAxis
            dataKey="lap"
            type="number"
            domain={lapDomain ?? ['dataMin', 'dataMax']}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={{ stroke: '#2a2a2a' }}
            label={{ value: 'Lap', position: 'insideBottomRight', offset: -4, fill: '#555', fontSize: 10 }}
          />
          {/* Left axis: temperatures */}
          <YAxis
            yAxisId="temp"
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v: number) => `${v}°`}
          />
          {/* Right axis: humidity */}
          <YAxis
            yAxisId="humid"
            orientation="right"
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={36}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 6,
              fontFamily: 'JetBrains Mono',
              fontSize: 11,
            }}
            labelStyle={{ color: '#888', marginBottom: 4 }}
            itemStyle={{ color: '#fff', padding: '1px 0' }}
            labelFormatter={(v) => `Lap ${v}`}
            formatter={(v, name) => {
              const n = Number(v ?? 0)
              if (name === 'AirTemp' || name === 'TrackTemp') return [`${n.toFixed(1)}°C`, String(name)]
              if (name === 'Humidity') return [`${n.toFixed(0)}%`, String(name)]
              return [String(v), String(name)]
            }}
          />
          {hasRain && (
            <Bar
              yAxisId="humid"
              dataKey="Rainfall"
              fill="#1e3a5f"
              opacity={0.6}
              isAnimationActive={false}
            />
          )}
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="TrackTemp"
            stroke="#e10600"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="AirTemp"
            stroke="#ff8700"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            yAxisId="humid"
            type="monotone"
            dataKey="Humidity"
            stroke="#4488cc"
            strokeWidth={1}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 2 }}
            isAnimationActive={false}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', paddingTop: 2 }}
            formatter={(value) => (
              <span style={{ color: '#888' }}>{value}</span>
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
