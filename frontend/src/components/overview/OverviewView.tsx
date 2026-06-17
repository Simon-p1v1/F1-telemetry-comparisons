import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useEvents } from '../../hooks/useEvents'
import { api } from '../../api/client'
import { getTeamColor } from '../../utils/colors'
import type { Event, Result } from '../../types/api'

type ChartRow = Record<string, number | string>

function getRaceDate(ev: Event): string | null {
  if (ev.Session5 === 'Race') return ev.Session5Date
  if (ev.Session4 === 'Race') return ev.Session4Date
  if (ev.Session3 === 'Race') return ev.Session3Date
  if (ev.Session2 === 'Race') return ev.Session2Date
  if (ev.Session1 === 'Race') return ev.Session1Date
  return ev.EventDate
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipItem {
  dataKey: string
  value: number
  stroke: string
  payload: ChartRow
}

function StandingsTooltip({
  active, payload, label, colorFn,
}: {
  active?: boolean
  payload?: TooltipItem[]
  label?: number
  colorFn: (key: string) => string
}) {
  if (!active || !payload?.length) return null
  const event = (payload[0]?.payload?.event as string) ?? ''
  const sorted = [...payload]
    .filter((p) => p.value != null && !isNaN(p.value))
    .sort((a, b) => a.value - b.value)

  if (!sorted.length) return null

  const half = Math.ceil(sorted.length / 2)
  const cols = [sorted.slice(0, half), sorted.slice(half)]

  const row = (p: TooltipItem) => {
    const pts = (p.payload[`${p.dataKey}_pts`] as number | undefined) ?? null
    return (
      <div
        key={p.dataKey}
        style={{ display: 'flex', gap: 5, alignItems: 'center', lineHeight: '1.65', whiteSpace: 'nowrap' }}
      >
        <span style={{ color: colorFn(p.dataKey), fontWeight: 700, minWidth: 20 }}>P{p.value}</span>
        <span style={{ color: '#ccc', minWidth: 28 }}>{p.dataKey}</span>
        {pts !== null && (
          <span style={{ color: '#666', fontSize: 9 }}>{Math.round(pts)} pts</span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      background: '#111', border: '1px solid #2a2a2a', borderRadius: 4,
      padding: '6px 10px', fontSize: 10,
    }}>
      <div style={{ color: '#555', marginBottom: 5 }}>R{label} · {event}</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div>{cols[0].map(row)}</div>
        {cols[1].length > 0 && <div>{cols[1].map(row)}</div>}
      </div>
    </div>
  )
}

// ─── Chart ───────────────────────────────────────────────────────────────────

interface StandingsChartProps {
  title: string
  data: ChartRow[]
  series: string[]
  colorFn: (key: string) => string
  maxPos: number
  highlighted: Set<string>
  onToggle: (key: string) => void
  onReset: () => void
  secondSeries?: Set<string>
}

function StandingsChart({
  title, data, series, colorFn, maxPos,
  highlighted, onToggle, onReset, secondSeries,
}: StandingsChartProps) {
  const yTicks = maxPos <= 10
    ? Array.from({ length: maxPos }, (_, i) => i + 1)
    : [1, 5, 10, 15, 20]

  const isActive = (s: string) => highlighted.size === 0 || highlighted.has(s)

  const renderTooltip = (props: any) => (
    <StandingsTooltip {...props} colorFn={colorFn} />
  )

  return (
    <div className="rounded border border-border p-4" style={{ background: '#0d0d0d' }}>
      <h3 className="text-[10px] text-muted uppercase tracking-widest mb-3">{title}</h3>

      {!data.length || !series.length ? (
        <div className="h-48 flex items-center justify-center text-muted text-xs">No data yet</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" />
              <XAxis
                dataKey="round"
                tick={{ fill: '#555', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2a2a' }}
                label={{ value: 'Round', position: 'insideBottom', offset: -2, fill: '#444', fontSize: 9 }}
              />
              <YAxis
                reversed
                domain={[1, maxPos]}
                ticks={yTicks}
                tickFormatter={(v) => `P${v}`}
                tick={{ fill: '#555', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#2a2a2a' }}
                width={28}
              />
              <Tooltip content={renderTooltip} />
              {series.map((s) => (
                <Line
                  key={s}
                  dataKey={s}
                  stroke={colorFn(s)}
                  strokeWidth={isActive(s) ? 1.8 : 1}
                  strokeOpacity={isActive(s) ? 1 : 0.1}
                  strokeDasharray={secondSeries?.has(s) ? '6 3' : undefined}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* Legend — clickable */}
          <div className="flex items-start justify-between mt-2.5 gap-3">
            <div className="flex flex-wrap gap-x-3 gap-y-1 flex-1">
              {series.map((s) => (
                <button
                  key={s}
                  onClick={() => onToggle(s)}
                  className="flex items-center gap-1 transition-opacity focus:outline-none"
                  style={{ opacity: isActive(s) ? 1 : 0.3 }}
                  title={highlighted.has(s) ? 'Click to deselect' : 'Click to highlight'}
                >
                  <div
                    className="flex-shrink-0 rounded-sm"
                    style={{
                      width: 14,
                      height: 3,
                      backgroundColor: colorFn(s),
                      backgroundImage: secondSeries?.has(s)
                        ? `repeating-linear-gradient(to right, ${colorFn(s)} 0px, ${colorFn(s)} 6px, transparent 6px, transparent 9px)`
                        : undefined,
                      opacity: secondSeries?.has(s) ? undefined : 1,
                    }}
                  />
                  <span className="text-[9px] text-muted">{s}</span>
                </button>
              ))}
            </div>
            {highlighted.size > 0 && (
              <button
                onClick={onReset}
                className="text-[9px] text-muted border border-border rounded px-2 py-0.5 hover:text-white hover:border-white/30 transition-colors flex-shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OverviewView({ year }: { year: number }) {
  const { data: events } = useEvents(year)

  const [highlightedDrivers, setHighlightedDrivers] = useState<Set<string>>(new Set())
  const [highlightedTeams, setHighlightedTeams] = useState<Set<string>>(new Set())

  // All race rounds for the season (completed + future) → full X-axis
  const allRaceEvents = useMemo(() => {
    if (!events) return []
    return events
      .filter((ev) =>
        [ev.Session1, ev.Session2, ev.Session3, ev.Session4, ev.Session5].some((s) => s === 'Race'),
      )
      .sort((a, b) => a.RoundNumber - b.RoundNumber)
  }, [events])

  // Completed races only → fetch results
  const completedRaceEvents = useMemo(() => {
    const now = Date.now()
    return allRaceEvents.filter((ev) => {
      const raceDate = getRaceDate(ev)
      return raceDate != null && new Date(raceDate).getTime() <= now
    })
  }, [allRaceEvents])

  const resultQueries = useQueries({
    queries: completedRaceEvents.map((ev) => ({
      queryKey: ['results', year, ev.EventName, 'R'],
      queryFn: () => api.results(year, ev.EventName, 'R'),
      staleTime: Infinity,
    })),
  })

  const loadedCount = resultQueries.filter((q) => q.data).length
  const totalCount = completedRaceEvents.length

  const {
    driverData, teamData, driverTeamMap, sortedDrivers, sortedTeams, secondDrivers,
  } = useMemo(() => {
    const roundData = completedRaceEvents
      .map((ev, i) => ({
        round: ev.RoundNumber,
        event: ev.Location,
        results: resultQueries[i]?.data as Result[] | undefined,
      }))
      .filter((r): r is { round: number; event: string; results: Result[] } => r.results != null)
      .sort((a, b) => a.round - b.round)

    if (!roundData.length) {
      return {
        driverData: [], teamData: [], driverTeamMap: {},
        sortedDrivers: [], sortedTeams: [], secondDrivers: new Set<string>(),
      }
    }

    const driverPoints: Record<string, number> = {}
    const teamPoints: Record<string, number> = {}
    const driverTeamMap: Record<string, string> = {}
    const completedDriverData: ChartRow[] = []
    const completedTeamData: ChartRow[] = []

    for (const { round, event, results } of roundData) {
      for (const r of results) {
        if (r.Abbreviation) {
          driverPoints[r.Abbreviation] = (driverPoints[r.Abbreviation] ?? 0) + (r.Points ?? 0)
          driverTeamMap[r.Abbreviation] = r.TeamName
        }
        if (r.TeamName) {
          teamPoints[r.TeamName] = (teamPoints[r.TeamName] ?? 0) + (r.Points ?? 0)
        }
      }

      // Driver row: position + points
      const driverRow: ChartRow = { round, event }
      Object.entries(driverPoints)
        .sort((a, b) => b[1] - a[1])
        .forEach(([d, pts], i) => {
          driverRow[d] = i + 1
          driverRow[`${d}_pts`] = pts
        })
      completedDriverData.push(driverRow)

      // Team row: position + points
      const teamRow: ChartRow = { round, event }
      Object.entries(teamPoints)
        .sort((a, b) => b[1] - a[1])
        .forEach(([t, pts], i) => {
          teamRow[t] = i + 1
          teamRow[`${t}_pts`] = pts
        })
      completedTeamData.push(teamRow)
    }

    // Merge completed data into full-season axis (future rounds = empty row)
    const completedDriverByRound = new Map(completedDriverData.map((d) => [d.round as number, d]))
    const completedTeamByRound = new Map(completedTeamData.map((d) => [d.round as number, d]))

    const driverData = allRaceEvents.map((ev) =>
      completedDriverByRound.get(ev.RoundNumber) ?? { round: ev.RoundNumber, event: ev.Location },
    )
    const teamData = allRaceEvents.map((ev) =>
      completedTeamByRound.get(ev.RoundNumber) ?? { round: ev.RoundNumber, event: ev.Location },
    )

    const lastDriver = completedDriverData[completedDriverData.length - 1]
    const lastTeam = completedTeamData[completedTeamData.length - 1]

    const sortedDrivers = Object.keys(driverPoints).sort(
      (a, b) => ((lastDriver?.[a] as number) ?? 99) - ((lastDriver?.[b] as number) ?? 99),
    )
    const sortedTeams = Object.keys(teamPoints).sort(
      (a, b) => ((lastTeam?.[a] as number) ?? 99) - ((lastTeam?.[b] as number) ?? 99),
    )

    // Second driver per team (worse championship standing) → dashed line
    const teamDrivers: Record<string, string[]> = {}
    for (const [driver, team] of Object.entries(driverTeamMap)) {
      if (!teamDrivers[team]) teamDrivers[team] = []
      teamDrivers[team].push(driver)
    }
    const secondDrivers = new Set<string>()
    for (const drivers of Object.values(teamDrivers)) {
      if (drivers.length >= 2) {
        const ranked = [...drivers].sort(
          (a, b) => ((lastDriver?.[a] as number) ?? 99) - ((lastDriver?.[b] as number) ?? 99),
        )
        secondDrivers.add(ranked[ranked.length - 1])
      }
    }

    return { driverData, teamData, driverTeamMap, sortedDrivers, sortedTeams, secondDrivers }
  }, [resultQueries, completedRaceEvents, allRaceEvents])

  function toggleDriver(d: string) {
    setHighlightedDrivers((prev) => {
      const next = new Set(prev)
      next.has(d) ? next.delete(d) : next.add(d)
      return next
    })
  }
  function toggleTeam(t: string) {
    setHighlightedTeams((prev) => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[10px] text-muted uppercase tracking-widest">
          Season Overview — {year}
        </span>
        {totalCount > 0 && loadedCount < totalCount && (
          <span className="text-[10px] text-muted flex items-center gap-1.5">
            <span className="w-3 h-3 border border-f1red border-t-transparent rounded-full animate-spin inline-block" />
            {loadedCount}/{totalCount} rounds
          </span>
        )}
      </div>

      {/* Charts */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {!events ? (
          <div className="flex items-center justify-center h-40 text-muted text-sm gap-2">
            <span className="w-4 h-4 border border-f1red border-t-transparent rounded-full animate-spin" />
            Loading season…
          </div>
        ) : allRaceEvents.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted text-sm">
            No race data available for {year}
          </div>
        ) : (
          <>
            <StandingsChart
              title="Driver Championship"
              data={driverData}
              series={sortedDrivers}
              colorFn={(d) => getTeamColor(driverTeamMap[d] ?? '')}
              maxPos={sortedDrivers.length || 20}
              highlighted={highlightedDrivers}
              onToggle={toggleDriver}
              onReset={() => setHighlightedDrivers(new Set())}
              secondSeries={secondDrivers}
            />
            <StandingsChart
              title="Constructor Championship"
              data={teamData}
              series={sortedTeams}
              colorFn={getTeamColor}
              maxPos={sortedTeams.length || 10}
              highlighted={highlightedTeams}
              onToggle={toggleTeam}
              onReset={() => setHighlightedTeams(new Set())}
            />
          </>
        )}
      </div>
    </div>
  )
}
