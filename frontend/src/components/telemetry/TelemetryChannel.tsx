import { useMemo, useRef, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from 'recharts'
import type { ChartRow } from '../../utils/telemetryMath'
import type { Corner } from '../../types/api'

interface TelemetryChannelProps {
  title: string
  unit: string
  data: ChartRow[]
  drivers: string[]
  driverColors: Record<string, string>
  driverDash?: Record<string, boolean>
  height?: number
  domain?: [number | 'auto', number | 'auto']
  syncId: string
  showXAxis?: boolean
  stepLine?: boolean
  formatter?: (v: number) => string
  showMinMax?: boolean
  corners?: Corner[]
  registerCursor?: (fn: (dist: number | null) => void) => () => void
  onCursorMove?: (dist: number | null) => void
}

const TICK_STYLE = { fill: '#888', fontSize: 10, fontFamily: 'JetBrains Mono' }
const Y_AXIS_W = 36
const MARGIN_RIGHT = 8

function fmt2dp(v: number) {
  return v.toFixed(2)
}

export default function TelemetryChannel({
  title,
  unit,
  data,
  drivers,
  driverColors,
  driverDash,
  height = 110,
  domain,
  showXAxis = false,
  stepLine = false,
  formatter = fmt2dp,
  showMinMax = false,
  corners,
  registerCursor,
  onCursorMove,
}: TelemetryChannelProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cursorLineRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Pre-process step-line data: insert intermediate points to simulate step-after
  // using type="linear", which allows strokeDasharray to work (recharts bug workaround)
  const displayData = useMemo(() => {
    if (!stepLine || data.length < 2) return data
    const result: ChartRow[] = []
    for (let i = 0; i < data.length; i++) {
      result.push(data[i])
      if (i < data.length - 1) {
        const mid: ChartRow = { distance: data[i + 1].distance - 0.01 }
        for (const key of Object.keys(data[i])) {
          if (key !== 'distance') mid[key] = data[i][key]
        }
        result.push(mid)
      }
    }
    return result
  }, [stepLine, data])

  const minMaxDots = useMemo(() => {
    if (!showMinMax || !data.length) return []
    return drivers.flatMap((driver) => {
      const valid = data.filter((r) => r[driver] != null)
      if (!valid.length) return []
      const maxRow = valid.reduce((a, b) => ((a[driver] as number) > (b[driver] as number) ? a : b))
      const minRow = valid.reduce((a, b) => ((a[driver] as number) < (b[driver] as number) ? a : b))
      return [
        { driver, kind: 'max' as const, x: maxRow.distance, y: maxRow[driver] as number },
        { driver, kind: 'min' as const, x: minRow.distance, y: minRow[driver] as number },
      ]
    })
  }, [showMinMax, data, drivers])

  // Register imperative cursor updater — bypasses React re-renders entirely
  useEffect(() => {
    if (!registerCursor) return

    const update = (dist: number | null) => {
      const wrapper = wrapperRef.current
      const cursorLine = cursorLineRef.current
      const tooltip = tooltipRef.current
      if (!wrapper || !cursorLine || !tooltip) return

      if (dist == null || !data.length) {
        cursorLine.style.display = 'none'
        tooltip.style.display = 'none'
        return
      }

      const containerW = wrapper.clientWidth
      const chartAreaW = Math.max(containerW - Y_AXIS_W - MARGIN_RIGHT, 1)
      const dataMin = data[0].distance as number
      const dataMax = data[data.length - 1].distance as number
      if (dataMax <= dataMin) return

      const pixelX = Y_AXIS_W + ((dist - dataMin) / (dataMax - dataMin)) * chartAreaW

      // Move cursor line
      cursorLine.style.display = 'block'
      cursorLine.style.left = pixelX + 'px'

      // Find closest data point and build tooltip
      const row = data.reduce((prev, curr) =>
        Math.abs(curr.distance - dist) < Math.abs(prev.distance - dist) ? curr : prev,
      )

      const distKm = ((row.distance as number) / 1000).toFixed(2)
      let html = `<div style="color:#888;margin-bottom:3px;font-size:10px">${distKm} km</div>`
      for (const driver of drivers) {
        const val = row[driver]
        if (val == null) continue
        const color = driverColors[driver] ?? '#fff'
        html += `<div style="color:${color};padding:1px 0">${driver}: ${formatter(Number(val))}</div>`
      }
      tooltip.innerHTML = html

      const isRight = pixelX > containerW / 2
      tooltip.style.display = 'block'
      tooltip.style.left = (isRight ? pixelX - 8 : pixelX + 8) + 'px'
      tooltip.style.transform = isRight ? 'translateX(-100%)' : 'none'
    }

    return registerCursor(update)
  }, [registerCursor, data, drivers, driverColors, formatter])

  const chartHeight = height - 18

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-center gap-2 mb-0.5 px-1">
        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">{title}</span>
        <span className="text-[10px] text-muted/60">{unit}</span>
      </div>

      <div ref={wrapperRef} style={{ position: 'relative', height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 2, right: MARGIN_RIGHT, bottom: 0, left: 0 }}
            onMouseMove={(e) => {
              if (e?.activeLabel != null) onCursorMove?.(Number(e.activeLabel))
            }}
            onMouseLeave={() => onCursorMove?.(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
            <XAxis
              dataKey="distance"
              hide={!showXAxis}
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={{ stroke: '#2a2a2a' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}km`}
              domain={['dataMin', 'dataMax']}
              type="number"
            />
            <YAxis
              tick={TICK_STYLE}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_W}
              domain={domain}
              tickFormatter={(v: number) => String(Math.round(v))}
            />
            <ReferenceLine y={0} stroke="#333" strokeDasharray="4 2" />
            {corners?.map((c) => (
              <ReferenceLine
                key={`c${c.Number}${c.Letter}`}
                x={c.Distance}
                stroke="#404040"
                strokeDasharray="2 4"
                strokeWidth={1}
                label={{
                  value: `T${c.Number}${c.Letter}`,
                  position: 'insideTop',
                  fill: '#555',
                  fontSize: 8,
                  fontFamily: 'JetBrains Mono',
                }}
              />
            ))}
            {drivers.map((driver) => (
              <Line
                key={driver}
                type={stepLine ? 'linear' : 'monotoneX'}
                dataKey={driver}
                stroke={driverColors[driver] ?? '#888'}
                strokeWidth={1.5}
                strokeDasharray={driverDash?.[driver] ? '6 3' : undefined}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {minMaxDots.map(({ driver, kind, x, y }) => (
              <ReferenceDot
                key={`${driver}-${kind}`}
                x={x}
                y={y}
                r={4}
                fill={kind === 'max' ? (driverColors[driver] ?? '#888') : '#111'}
                stroke={driverColors[driver] ?? '#888'}
                strokeWidth={2}
                ifOverflow="extendDomain"
                label={{
                  value: String(Math.round(y)),
                  position: kind === 'max' ? 'top' : 'bottom',
                  fill: '#ccc',
                  fontSize: 9,
                  fontFamily: 'JetBrains Mono',
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Cursor line — moved imperatively, no React re-render */}
        <div
          ref={cursorLineRef}
          style={{
            display: 'none',
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 1,
            background: 'rgba(255,255,255,0.35)',
            pointerEvents: 'none',
            zIndex: 5,
            transform: 'translateX(-0.5px)',
          }}
        />

        {/* Tooltip — updated imperatively via innerHTML */}
        <div
          ref={tooltipRef}
          style={{
            display: 'none',
            position: 'absolute',
            top: 4,
            pointerEvents: 'none',
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 6,
            padding: '4px 7px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        />
      </div>
    </div>
  )
}
