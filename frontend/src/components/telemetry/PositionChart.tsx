import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Lap } from '../../types/api'

interface PositionChartProps {
  laps: Lap[]
  drivers: string[]
  driverColors: Record<string, string>
  driverDash?: Record<string, boolean>
  lapDomain?: [number, number]
}

const TICK_STYLE = { fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }

export default function PositionChart({ laps, drivers, driverColors, driverDash, lapDomain }: PositionChartProps) {
  if (!laps.length || !drivers.length) return null

  // Find max lap number
  const maxLap = lapDomain ? lapDomain[1] : Math.max(...laps.map((l) => l.LapNumber))

  // Build per-lap data: { lap, DRV: position, ... }
  const data = Array.from({ length: maxLap }, (_, i) => {
    const lapNum = i + 1
    const row: Record<string, number> = { lap: lapNum }
    for (const d of drivers) {
      const lapRecord = laps.find((l) => l.Driver === d && l.LapNumber === lapNum)
      if (lapRecord?.Position != null) row[d] = lapRecord.Position
    }
    return row
  })

  return (
    <div className="w-full" style={{ height: 260 }}>
      <div className="flex items-center gap-2 mb-0.5 px-1">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Position</span>
        <span className="text-[10px] text-muted/60">race trace</span>
      </div>
      <ResponsiveContainer width="100%" height={242}>
        <LineChart data={data} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
          <XAxis
            dataKey="lap"
            type="number"
            domain={lapDomain ?? [1, maxLap]}
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={{ stroke: '#2a2a2a' }}
            label={{ value: 'Lap', position: 'insideBottomRight', offset: -5, fill: '#666', fontSize: 10 }}
          />
          <YAxis
            tick={TICK_STYLE}
            tickLine={false}
            axisLine={false}
            width={24}
            reversed
            domain={[1, 20]}
            tickFormatter={(v: number) => String(v)}
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
            formatter={(v, name) => [`P${v}`, String(name)]}
          />
          {drivers.map((driver) => (
            <Line
              key={driver}
              type="stepAfter"
              dataKey={driver}
              stroke={driverColors[driver] ?? '#888'}
              strokeWidth={1.5}
              strokeDasharray={driverDash?.[driver] ? '6 3' : undefined}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
