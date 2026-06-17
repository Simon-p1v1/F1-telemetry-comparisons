import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { Lap, Result } from '../../types/api'

interface RaceGapChartProps {
  laps: Lap[]
  results: Result[]
  selectedDrivers: string[]
  driverColors: Record<string, string>
  driverDash?: Record<string, boolean>
  lapDomain?: [number, number]
}

type RefMode = 'leader' | 'driver'

const TICK_STYLE = { fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }

function fmtGap(v: number) {
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}s`
}

export default function RaceGapChart({
  laps,
  results,
  selectedDrivers,
  driverColors,
  driverDash,
  lapDomain,
}: RaceGapChartProps) {
  const [refMode, setRefMode] = useState<RefMode>('leader')
  const [refDriver, setRefDriver] = useState<string>('')

  // Cumulative race time per driver per lap
  const cumulativeTimes = useMemo(() => {
    const map = new Map<string, Map<number, number>>()
    const allDrivers = [...new Set(laps.map((l) => l.Driver))]
    for (const driver of allDrivers) {
      const driverLaps = laps
        .filter((l) => l.Driver === driver && l.LapTime !== null)
        .sort((a, b) => a.LapNumber - b.LapNumber)
      let cum = 0
      const lapMap = new Map<number, number>()
      for (const lap of driverLaps) {
        cum += lap.LapTime!
        lapMap.set(lap.LapNumber, cum)
      }
      map.set(driver, lapMap)
    }
    return map
  }, [laps])

  const chartData = useMemo(() => {
    if (laps.length === 0) return []
    const maxLap = Math.max(...laps.map((l) => l.LapNumber))

    return Array.from({ length: maxLap }, (_, i) => {
      const lap = i + 1
      const row: Record<string, number> = { lap }

      // Determine reference cumulative time at this lap
      let refTime: number | undefined
      if (refMode === 'leader') {
        let min = Infinity
        for (const lapMap of cumulativeTimes.values()) {
          const t = lapMap.get(lap)
          if (t !== undefined && t < min) min = t
        }
        refTime = min === Infinity ? undefined : min
      } else {
        refTime = refDriver ? cumulativeTimes.get(refDriver)?.get(lap) : undefined
      }

      if (refTime === undefined) return row

      for (const driver of selectedDrivers) {
        if (refMode === 'driver' && driver === refDriver) continue
        const driverTime = cumulativeTimes.get(driver)?.get(lap)
        if (driverTime !== undefined) {
          row[driver] = driverTime - refTime
        }
      }

      return row
    })
  }, [laps, cumulativeTimes, selectedDrivers, refMode, refDriver])

  const visibleDrivers =
    refMode === 'driver' && refDriver
      ? selectedDrivers.filter((d) => d !== refDriver)
      : selectedDrivers

  if (!laps.length) {
    return (
      <div className="flex items-center px-2 py-3 text-[10px] text-muted">
        Gap — no lap data loaded
      </div>
    )
  }

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {(['leader', 'driver'] as RefMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setRefMode(m)}
              className={[
                'px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded transition-colors',
                refMode === m
                  ? 'bg-f1red/20 text-f1red border border-f1red/40'
                  : 'bg-surface text-muted border border-border hover:text-white',
              ].join(' ')}
            >
              {m === 'leader' ? 'Gap to Leader' : 'Gap to Driver'}
            </button>
          ))}
        </div>

        {refMode === 'driver' && (
          <select
            value={refDriver}
            onChange={(e) => setRefDriver(e.target.value)}
            className="bg-surface border border-border text-white text-xs px-2 py-1 rounded focus:outline-none focus:border-f1red"
          >
            <option value="">— Reference driver —</option>
            {results.map((r) => (
              <option key={r.Abbreviation} value={r.Abbreviation}>
                {r.Abbreviation}
              </option>
            ))}
          </select>
        )}

        {refMode === 'leader' && (
          <span className="text-[10px] text-muted">gap to the race leader at each lap</span>
        )}
      </div>

      {/* Chart */}
      {visibleDrivers.length === 0 ? (
        <div className="text-[10px] text-muted py-2">
          {refMode === 'driver' && !refDriver
            ? 'Select a reference driver above'
            : 'Select drivers in the sidebar'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
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
            <YAxis
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={fmtGap}
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
              formatter={(v, name) => [fmtGap(Number(v ?? 0)), String(name)]}
            />
            <ReferenceLine y={0} stroke="#e10600" strokeDasharray="4 2" strokeWidth={1} />
            {visibleDrivers.map((driver) => (
              <Line
                key={driver}
                type="monotoneX"
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
      )}
    </div>
  )
}
