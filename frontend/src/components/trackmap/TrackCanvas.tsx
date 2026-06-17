import { useRef, useEffect } from 'react'
import type { TelemetryPoint, MetricKey } from '../../types/api'
import { heatmapColor } from '../../utils/colors'

interface TrackCanvasProps {
  telemetry: TelemetryPoint[]
  metric: MetricKey
}

const METRIC_LABELS: Record<MetricKey, string> = {
  Speed: 'Speed (km/h)',
  Throttle: 'Throttle (%)',
  Brake: 'Brake (0/1)',
  nGear: 'Gear',
  RPM: 'RPM',
  DRS: 'DRS',
}

// Vertical legend on the right side
function drawSideLegend(
  ctx: CanvasRenderingContext2D,
  x: number,   // left edge of the legend strip
  y: number,   // top of gradient bar
  h: number,   // height of gradient bar
  minVal: number,
  maxVal: number,
  label: string,
) {
  const barW = 14

  // Gradient: top = max (red), bottom = min (blue)
  const grad = ctx.createLinearGradient(x, y, x, y + h)
  for (let i = 0; i <= 20; i++) {
    grad.addColorStop(i / 20, heatmapColor(1 - i / 20))
  }
  ctx.fillStyle = grad
  ctx.fillRect(x, y, barW, h)
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 0.5
  ctx.strokeRect(x, y, barW, h)

  // Tick marks + value labels (left of bar)
  ctx.fillStyle = '#aaa'
  ctx.font = '11px JetBrains Mono, monospace'
  ctx.textAlign = 'right'
  const ticks = 5
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks
    const ty = y + t * h
    const val = maxVal - t * (maxVal - minVal)
    ctx.fillStyle = '#555'
    ctx.fillRect(x - 4, ty - 0.5, 4, 1)
    ctx.fillStyle = '#aaa'
    ctx.fillText(String(Math.round(val)), x - 7, ty + 4)
  }

  // Metric label: rotated 90° to the right of the bar
  ctx.save()
  ctx.translate(x + barW + 14, y + h / 2)
  ctx.rotate(Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#888'
  ctx.font = '11px Inter, sans-serif'
  ctx.fillText(label, 0, 0)
  ctx.restore()
}

export default function TrackCanvas({ telemetry, metric }: TrackCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const logicalW = wrapper.clientWidth
      const logicalH = wrapper.clientHeight
      if (!logicalW || !logicalH) return

      // Set canvas backing store size
      canvas.width = logicalW * dpr
      canvas.height = logicalH * dpr
      // CSS size stays at 100%
      canvas.style.width = `${logicalW}px`
      canvas.style.height = `${logicalH}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)

      const W = logicalW
      const H = logicalH

      const pts = telemetry.filter(
        (p) => p.X !== null && p.Y !== null && p[metric] !== null,
      )
      if (pts.length < 2) {
        ctx.clearRect(0, 0, W, H)
        ctx.fillStyle = '#555'
        ctx.font = '13px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('No position data available', W / 2, H / 2)
        return
      }

      const xs = pts.map((p) => p.X!)
      const ys = pts.map((p) => p.Y!)
      const minX = Math.min(...xs), maxX = Math.max(...xs)
      const minY = Math.min(...ys), maxY = Math.max(...ys)
      const rangeX = maxX - minX || 1
      const rangeY = maxY - minY || 1

      const PAD = 28
      // Right side: room for tick labels (36px) + bar (14px) + label (18px) + margin
      const LEGEND_TOTAL = 80
      const drawW = W - PAD * 2 - LEGEND_TOTAL
      const drawH = H - PAD * 2

      const scale = Math.min(drawW / rangeX, drawH / rangeY)
      const offsetX = PAD + (drawW - rangeX * scale) / 2
      const offsetY = PAD + (drawH - rangeY * scale) / 2

      const toX = (x: number) => offsetX + (x - minX) * scale
      const toY = (y: number) => offsetY + drawH - (y - minY) * scale

      const metricValues = pts.map((p) => (p[metric] as number) ?? 0)
      const minVal = Math.min(...metricValues)
      const maxVal = Math.max(...metricValues)
      const range = maxVal - minVal || 1

      ctx.clearRect(0, 0, W, H)

      // Track outline (grey shadow)
      ctx.beginPath()
      ctx.moveTo(toX(pts[0].X!), toY(pts[0].Y!))
      for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].X!), toY(pts[i].Y!))
      ctx.strokeStyle = '#2a2a2a'
      ctx.lineWidth = 10
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.stroke()

      // Colored heatmap segments
      ctx.lineWidth = 5
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      for (let i = 1; i < pts.length; i++) {
        const val = (pts[i][metric] as number) ?? 0
        ctx.beginPath()
        ctx.strokeStyle = heatmapColor((val - minVal) / range)
        ctx.moveTo(toX(pts[i - 1].X!), toY(pts[i - 1].Y!))
        ctx.lineTo(toX(pts[i].X!), toY(pts[i].Y!))
        ctx.stroke()
      }

      // Start/finish dot
      ctx.beginPath()
      ctx.arc(toX(pts[0].X!), toY(pts[0].Y!), 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(toX(pts[0].X!), toY(pts[0].Y!), 3, 0, Math.PI * 2)
      ctx.fillStyle = '#e10600'
      ctx.fill()

      // Side legend
      const legendX = W - LEGEND_TOTAL + 4
      drawSideLegend(ctx, legendX, PAD, drawH, minVal, maxVal, METRIC_LABELS[metric])
    }

    draw()

    const ro = new ResizeObserver(draw)
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [telemetry, metric])

  return (
    <div ref={wrapperRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        className="rounded border border-border"
        style={{ background: '#0a0a0a', display: 'block' }}
      />
    </div>
  )
}
