import { useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLaps } from '../../hooks/useLaps'
import { api } from '../../api/client'
import { getFastestLapNumber } from '../../utils/telemetryMath'
import { getTeamColor } from '../../utils/colors'
import type { Result, MetricKey, TelemetryPoint } from '../../types/api'

export { type MetricKey }

export const TRACK_METRICS: { key: MetricKey; label: string }[] = [
  { key: 'Speed',    label: 'Speed' },
  { key: 'Throttle', label: 'Throttle' },
  { key: 'Brake',    label: 'Brake' },
  { key: 'nGear',    label: 'Gear' },
  { key: 'RPM',      label: 'RPM' },
  { key: 'DRS',      label: 'DRS' },
]

// Blue → Cyan → Green → Yellow → Red
const STOPS: [number, number, number][] = [
  [59,  130, 246],
  [6,   182, 212],
  [34,  197, 94],
  [234, 179, 8],
  [239, 68,  68],
]

function valueToColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t)) * (STOPS.length - 1)
  const i = Math.floor(clamped)
  const f = clamped - i
  const a = STOPS[Math.min(i, STOPS.length - 1)]
  const b = STOPS[Math.min(i + 1, STOPS.length - 1)]
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`
}

const SVG_W = 400
const SVG_H = 280
const PAD = 18

interface TrackTransform {
  scale: number
  ox: number
  oy: number
  pts: TelemetryPoint[]
  vMin: number
  vMax: number
}

interface TrackMapProps {
  year: number
  event: string
  session: string
  results: Result[]
  driver: string | null
  metric: MetricKey
  onDriverChange: (driver: string | null) => void
  onMetricChange: (metric: MetricKey) => void
  onDelete: () => void
  large?: boolean
  registerCursor?: (fn: (dist: number | null) => void) => () => void
  onCursorMove?: (dist: number | null) => void
}

export default function TrackMap({
  year, event, session, results,
  driver, metric,
  onDriverChange, onMetricChange, onDelete,
  large = false,
  registerCursor,
  onCursorMove,
}: TrackMapProps) {
  const { data: laps } = useLaps(year, event, session)

  const lapNum = useMemo(() => {
    if (!laps || !driver) return null
    return getFastestLapNumber(laps, driver)
  }, [laps, driver])

  const { data: telemetry, isLoading } = useQuery({
    queryKey: ['telemetry', year, event, session, driver, lapNum],
    queryFn: () => api.telemetry(year, event, session, driver!, lapNum!),
    enabled: !!(driver && lapNum),
    staleTime: Infinity,
  })

  const { segments, vMin, vMax } = useMemo(() => {
    if (!telemetry) return { segments: [], vMin: 0, vMax: 1 }
    const pts = telemetry.filter((p) => p.X != null && p.Y != null && p[metric] != null)
    if (pts.length < 2) return { segments: [], vMin: 0, vMax: 1 }

    const xs = pts.map((p) => p.X!)
    const ys = pts.map((p) => p.Y!)
    const vals = pts.map((p) => p[metric] as number)
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const vMin = Math.min(...vals), vMax = Math.max(...vals)
    const range = vMax > vMin ? vMax - vMin : 1

    const trackW = xMax - xMin || 1
    const trackH = yMax - yMin || 1
    const scale = Math.min((SVG_W - PAD * 2) / trackW, (SVG_H - PAD * 2) / trackH)
    const ox = (SVG_W - trackW * scale) / 2 - xMin * scale
    const oy = (SVG_H - trackH * scale) / 2 - yMin * scale
    const toSVG = (x: number, y: number) => ({
      sx: x * scale + ox,
      sy: SVG_H - (y * scale + oy),
    })

    const segments = pts.slice(1).map((pt, i) => {
      const prev = pts[i]
      const { sx: x1, sy: y1 } = toSVG(prev.X!, prev.Y!)
      const { sx: x2, sy: y2 } = toSVG(pt.X!, pt.Y!)
      return { x1, y1, x2, y2, color: valueToColor((vals[i + 1] - vMin) / range) }
    })

    return { segments, vMin, vMax }
  }, [telemetry, metric])

  const driverColor = useMemo(() => {
    if (!driver) return '#555'
    const res = results.find((r) => r.Abbreviation === driver)
    return res ? getTeamColor(res.TeamName) : '#555'
  }, [driver, results])

  // Store transform + filtered pts in a ref for imperative cursor updates
  const transformRef = useRef<TrackTransform | null>(null)
  const scrubberRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!telemetry) { transformRef.current = null; return }
    const pts = telemetry.filter((p) => p.X != null && p.Y != null && p[metric] != null && p.Distance != null)
    if (pts.length < 2) { transformRef.current = null; return }

    const xs = pts.map((p) => p.X!)
    const ys = pts.map((p) => p.Y!)
    const vals = pts.map((p) => p[metric] as number)
    const xMin = Math.min(...xs), xMax = Math.max(...xs)
    const yMin = Math.min(...ys), yMax = Math.max(...ys)
    const vMin = Math.min(...vals), vMax = Math.max(...vals)
    const trackW = xMax - xMin || 1
    const trackH = yMax - yMin || 1
    const scale = Math.min((SVG_W - PAD * 2) / trackW, (SVG_H - PAD * 2) / trackH)
    const ox = (SVG_W - trackW * scale) / 2 - xMin * scale
    const oy = (SVG_H - trackH * scale) / 2 - yMin * scale

    transformRef.current = { scale, ox, oy, pts, vMin, vMax }

    // Init scrubber range imperatively
    const distances = pts.map(p => p.Distance).filter((d): d is number => d != null)
    if (distances.length && scrubberRef.current) {
      const dMin = Math.min(...distances)
      const dMax = Math.max(...distances)
      scrubberRef.current.min = String(dMin)
      scrubberRef.current.max = String(dMax)
      scrubberRef.current.step = String(Math.max(1, Math.ceil((dMax - dMin) / 2000)))
      scrubberRef.current.value = String(dMin)
    }
  }, [telemetry, metric])

  // DOM refs for cursor elements
  const svgRef = useRef<SVGSVGElement>(null)
  const cursorCircleRef = useRef<SVGCircleElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const metricRef = useRef(metric)
  useEffect(() => { metricRef.current = metric }, [metric])

  // Register imperative cursor updater
  useEffect(() => {
    if (!registerCursor) return

    const update = (dist: number | null) => {
      const t = transformRef.current
      const circle = cursorCircleRef.current
      const tooltip = tooltipRef.current
      const svg = svgRef.current

      if (!t || !circle || !tooltip || !svg || dist == null) {
        if (circle) { circle.setAttribute('cx', '-999'); circle.setAttribute('cy', '-999') }
        if (tooltip) tooltip.style.display = 'none'
        return
      }

      if (scrubberRef.current) scrubberRef.current.value = String(dist)

      // Find closest point by Distance
      const pt = t.pts.reduce((prev, curr) =>
        Math.abs((curr.Distance ?? Infinity) - dist) < Math.abs((prev.Distance ?? Infinity) - dist) ? curr : prev,
      )
      if (pt.X == null || pt.Y == null) return

      // SVG viewBox coordinates
      const sx = pt.X * t.scale + t.ox
      const sy = SVG_H - (pt.Y * t.scale + t.oy)

      circle.setAttribute('cx', String(sx))
      circle.setAttribute('cy', String(sy))

      // Screen coordinates for tooltip (SVG uses viewBox scaling)
      const bbox = svg.getBoundingClientRect()
      const screenX = (sx / SVG_W) * bbox.width
      const screenY = (sy / SVG_H) * bbox.height

      const val = Number(pt[metricRef.current])
      const label = TRACK_METRICS.find((m) => m.key === metricRef.current)?.label ?? metricRef.current
      const distKm = ((pt.Distance ?? 0) / 1000).toFixed(2)

      tooltip.innerHTML = `
        <div style="color:#888;font-size:10px;margin-bottom:2px">${distKm} km</div>
        <div style="color:#fff">${label}: ${Number.isInteger(val) ? val : val.toFixed(1)}</div>
      `
      const isRight = screenX > bbox.width / 2
      tooltip.style.display = 'block'
      tooltip.style.left = (isRight ? screenX - 8 : screenX + 8) + 'px'
      tooltip.style.top = (screenY - 12) + 'px'
      tooltip.style.transform = isRight ? 'translateX(-100%)' : 'none'
    }

    return registerCursor(update)
  }, [registerCursor])

  // Emit cursor distance on mouse move over SVG
  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const t = transformRef.current
    const svg = svgRef.current
    if (!t || !svg || !onCursorMove) return

    const bbox = svg.getBoundingClientRect()
    const mouseX = ((e.clientX - bbox.left) / bbox.width) * SVG_W
    const mouseY = ((e.clientY - bbox.top) / bbox.height) * SVG_H

    // Find closest point in SVG space
    const closest = t.pts.reduce((prev, curr) => {
      const cx = curr.X! * t.scale + t.ox
      const cy = SVG_H - (curr.Y! * t.scale + t.oy)
      const px = prev.X! * t.scale + t.ox
      const py = SVG_H - (prev.Y! * t.scale + t.oy)
      return (cx - mouseX) ** 2 + (cy - mouseY) ** 2 < (px - mouseX) ** 2 + (py - mouseY) ** 2
        ? curr : prev
    })

    onCursorMove(closest.Distance ?? null)
  }, [onCursorMove])

  const handleSvgMouseLeave = useCallback(() => {
    onCursorMove?.(null)
  }, [onCursorMove])

  return (
    <div className="w-full rounded border border-border overflow-hidden" style={{ background: '#0d0d0d' }}>
      {/* Header — row 1: driver + delete */}
      <div className={`flex items-center gap-2 pt-1.5 pb-1 ${large ? 'px-2' : 'px-3'}`} style={{ background: '#111' }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: driverColor }} />
        <select
          value={driver ?? ''}
          onChange={(e) => onDriverChange(e.target.value || null)}
          className="bg-surface border border-border text-white text-xs px-2 py-1.5 rounded focus:outline-none focus:border-f1red flex-1 min-w-0"
        >
          <option value="">— Select driver —</option>
          {results.map((r) => (
            <option key={r.Abbreviation} value={r.Abbreviation}>
              {r.Abbreviation} – {r.TeamName}
            </option>
          ))}
        </select>
        {driver && lapNum && (
          <span className="text-[10px] text-muted font-mono flex-shrink-0">L{lapNum}</span>
        )}
        <button
          onClick={onDelete}
          className="ml-1 text-muted hover:text-white transition-colors p-0.5 flex-shrink-0"
          aria-label="Remove track map"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>

      {/* Header — row 2: metric buttons */}
      <div className={`flex items-center gap-1 pb-1.5 flex-wrap ${large ? 'px-2' : 'px-3'}`} style={{ background: '#111' }}>
        <span className="text-[10px] text-muted uppercase tracking-widest mr-1">Metric</span>
        {TRACK_METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => onMetricChange(m.key)}
            className={[
              'py-1 text-[10px] font-medium uppercase rounded transition-colors',
              large ? 'px-2 tracking-normal' : 'px-2.5 tracking-wider',
              metric === m.key
                ? 'bg-f1red/20 text-f1red border border-f1red/40'
                : 'bg-surface text-muted border border-border hover:text-white',
            ].join(' ')}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Map */}
      {!driver ? (
        <div className="flex items-center justify-center py-8 text-muted text-xs border-t border-border">
          Select a driver
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted text-xs border-t border-border">
          <div className="w-4 h-4 border-2 border-f1red border-t-transparent rounded-full animate-spin" />
          Loading…
        </div>
      ) : segments.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted text-xs border-t border-border">
          No data available
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full block"
              style={large ? { aspectRatio: `${SVG_W} / ${SVG_H}` } : { maxHeight: SVG_H }}
              onMouseMove={handleSvgMouseMove}
              onMouseLeave={handleSvgMouseLeave}
            >
              {segments.map((seg, i) => (
                <line
                  key={i}
                  x1={seg.x1} y1={seg.y1}
                  x2={seg.x2} y2={seg.y2}
                  stroke={seg.color}
                  strokeWidth={large ? 3 : 2.5}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {/* Cursor dot — moved imperatively */}
              <circle
                ref={cursorCircleRef}
                cx="-999" cy="-999" r="5"
                fill="white"
                stroke="#0d0d0d"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: 'none' }}
              />
            </svg>

            {/* Tooltip — updated imperatively */}
            <div
              ref={tooltipRef}
              style={{
                display: 'none',
                position: 'absolute',
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

          {/* Color scale */}
          <div className={`flex items-center gap-2 pt-1 ${large ? 'px-2' : 'px-4'}`}>
            <span className="text-[9px] text-muted font-mono w-8 text-right">{Math.round(vMin)}</span>
            <div
              className="flex-1 rounded"
              style={{
                height: 5,
                background: 'linear-gradient(to right, rgb(59,130,246), rgb(6,182,212), rgb(34,197,94), rgb(234,179,8), rgb(239,68,68))',
              }}
            />
            <span className="text-[9px] text-muted font-mono w-8">{Math.round(vMax)}</span>
          </div>

          {/* Scrubber — drag to move cursor along circuit */}
          <div className={`pb-2 ${large ? 'px-2' : 'px-4'}`}>
            <input
              ref={scrubberRef}
              type="range"
              onInput={(e) => onCursorMove?.(Number((e.target as HTMLInputElement).value))}
              style={{ width: '100%', accentColor: '#e10600', cursor: 'ew-resize', display: 'block' }}
            />
          </div>
        </>
      )}
    </div>
  )
}
