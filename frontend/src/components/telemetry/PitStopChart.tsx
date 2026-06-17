import { useMemo } from 'react'
import type { Lap } from '../../types/api'

interface PitStopChartProps {
  laps: Lap[]
  drivers: string[]
  driverColors: Record<string, string>
  maxLap?: number
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT:         '#ef4444',
  MEDIUM:       '#eab308',
  HARD:         '#d1d5db',
  INTERMEDIATE: '#22c55e',
  WET:          '#3b82f6',
}

function compoundColor(compound: string | null): string {
  if (!compound) return '#555'
  return COMPOUND_COLORS[compound.toUpperCase()] ?? '#555'
}

const isValidTime = (v: unknown): v is number => typeof v === 'number' && !isNaN(v) && v > 0

export default function PitStopChart({ laps, drivers, driverColors, maxLap }: PitStopChartProps) {
  const { driverRows, lapCount } = useMemo(() => {
    if (!laps.length || !drivers.length) return { driverRows: [], lapCount: 0 }

    const allLapNums = laps.map((l) => l.LapNumber).filter(Boolean)
    const dataLapCount = allLapNums.length ? Math.max(...allLapNums) : 0
    const lapCount = maxLap ?? dataLapCount

    const driverRows = drivers.map((driver) => {
      const driverLaps = laps
        .filter((l) => l.Driver === driver)
        .sort((a, b) => a.LapNumber - b.LapNumber)

      const cells = driverLaps.map((l) => ({
        lap: l.LapNumber,
        compound: l.Compound ?? null,
        pitIn: isValidTime(l.PitInTime),
      }))

      // Pad to lapCount with last known compound
      if (cells.length < lapCount) {
        const lastCompound = cells[cells.length - 1]?.compound ?? null
        for (let lap = cells.length + 1; lap <= lapCount; lap++) {
          cells.push({ lap, compound: lastCompound, pitIn: false })
        }
      }

      return { driver, cells }
    })

    return { driverRows, lapCount }
  }, [laps, drivers, maxLap])

  if (!driverRows.length || !lapCount) return null

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-1 px-1 flex-wrap">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Strategy</span>
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(COMPOUND_COLORS).map(([compound, color]) => (
            <div key={compound} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-muted">{compound.charAt(0) + compound.slice(1).toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5" style={{ marginLeft: 36, marginRight: 8 }}>
        {driverRows.map(({ driver, cells }) => (
          <div key={driver} className="flex items-center gap-1.5">
            {/* Driver label */}
            <div
              className="text-[9px] font-mono font-bold flex-shrink-0"
              style={{ width: 28, color: driverColors[driver] ?? '#aaa' }}
            >
              {driver}
            </div>
            {/* Strip */}
            <div className="flex items-stretch flex-1 rounded overflow-hidden relative" style={{ height: 16 }}>
              {cells.map(({ lap, compound, pitIn }) => (
                <div
                  key={lap}
                  className="relative group flex-1"
                  style={{ minWidth: 0 }}
                  title={`L${Math.round(lap)}: ${compound ?? '?'}`}
                >
                  {/* Compound color fill */}
                  <div
                    className="absolute inset-0"
                    style={{ backgroundColor: compoundColor(compound) }}
                  />
                  {/* Pit-in marker: right edge of this cell */}
                  {pitIn && (
                    <div
                      className="absolute right-0 top-0 bottom-0 z-10"
                      style={{ width: 2, backgroundColor: '#fff', opacity: 0.85 }}
                    />
                  )}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20
                    bg-panel border border-border rounded px-1.5 py-0.5 text-[9px] text-white whitespace-nowrap pointer-events-none">
                    L{Math.round(lap)} · {compound ?? '?'}{pitIn ? ' · Pit' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lap number axis */}
      <div
        className="flex items-center text-[8px] text-muted font-mono mt-0.5"
        style={{ marginLeft: 36 + 28 + 6, marginRight: 8 }}
      >
        {Array.from({ length: Math.min(10, lapCount) }, (_, i) => {
          const lap = Math.round(1 + (i * (lapCount - 1)) / Math.max(9, 1))
          return (
            <div key={lap} className="flex-1 text-center" style={{ minWidth: 0 }}>
              {lap}
            </div>
          )
        })}
      </div>
    </div>
  )
}
