import { useState, useMemo, useRef, useCallback } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import SortableItem from '../SortableItem'
import { useLaps } from '../../hooks/useLaps'
import { useCorners } from '../../hooks/useCorners'
import { api } from '../../api/client'
import {
  getFastestLapNumber,
  mergeChannelData,
} from '../../utils/telemetryMath'
import { getTeamColor } from '../../utils/colors'
import TelemetryChannel from './TelemetryChannel'
import PositionChart from './PositionChart'
import RaceGapChart from './RaceGapChart'
import WeatherChart from './WeatherChart'
import TrackStatusChart from './TrackStatusChart'
import PitStopChart from './PitStopChart'
import TrackMap from './TrackMap'
import type { TelemetryPoint, Result, MetricKey } from '../../types/api'

type Channel = 'speed' | 'throttle' | 'brake' | 'gear' | 'rpm' | 'drs' | 'delta' | 'position' | 'weather' | 'trackstatus' | 'pitstops'

const CHANNELS: { key: Channel; label: string; unit: string }[] = [
  { key: 'speed',       label: 'Speed',        unit: 'km/h' },
  { key: 'throttle',    label: 'Throttle',     unit: '%' },
  { key: 'brake',       label: 'Brake',        unit: '0/1' },
  { key: 'gear',        label: 'Gear',         unit: '' },
  { key: 'rpm',         label: 'RPM',          unit: '' },
  { key: 'drs',         label: 'DRS',          unit: '' },
  { key: 'delta',       label: 'Gap',          unit: 's' },
  { key: 'position',    label: 'Position',     unit: 'race trace' },
  { key: 'weather',     label: 'Weather',      unit: '' },
  { key: 'trackstatus', label: 'Track Status', unit: '' },
  { key: 'pitstops',    label: 'Strategy',     unit: '' },
]

const LAP_AXIS = new Set<Channel>(['position', 'weather', 'trackstatus', 'pitstops'])

interface TelemetryViewProps {
  year: number
  event: string
  session: string
  selectedDrivers: string[]
  results: Result[]
}

export default function TelemetryView({ year, event, session, selectedDrivers, results }: TelemetryViewProps) {
  const [activeChannels, setActiveChannels] = useState<Set<Channel>>(
    new Set(['speed', 'throttle', 'brake']),
  )

  // Cursor registry: imperative updates, no React re-renders on mouse move
  const cursorRegistry = useRef(new Set<(dist: number | null) => void>())
  const registerCursor = useCallback((fn: (dist: number | null) => void) => {
    cursorRegistry.current.add(fn)
    return () => { cursorRegistry.current.delete(fn) }
  }, [])
  const emitCursor = useCallback((dist: number | null) => {
    cursorRegistry.current.forEach(fn => fn(dist))
  }, [])
  const [channelOrder, setChannelOrder] = useState<Channel[]>(
    CHANNELS.map((c) => c.key),
  )

  type TrackMapState = { id: string; driver: string | null; metric: MetricKey }
  const [trackMaps, setTrackMaps] = useState<TrackMapState[]>([])

  function addTrackMap() {
    const id = crypto.randomUUID()
    setTrackMaps((prev) => [...prev, { id, driver: null, metric: 'Speed' }])
  }
  function removeTrackMap(id: string) {
    setTrackMaps((prev) => prev.filter((m) => m.id !== id))
  }
  function updateTrackMap(id: string, updates: Partial<TrackMapState>) {
    setTrackMaps((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }
  function handleTrackMapDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setTrackMaps((prev) => {
        const oldIdx = prev.findIndex((m) => m.id === active.id)
        const newIdx = prev.findIndex((m) => m.id === over.id)
        if (oldIdx === -1 || newIdx === -1) return prev
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  const { data: laps } = useLaps(year, event, session)
  const { data: corners } = useCorners(year, event, session)

  const lapNumbers = useMemo<Record<string, number | null>>(() => {
    if (!laps) return {}
    const m: Record<string, number | null> = {}
    for (const d of selectedDrivers) m[d] = getFastestLapNumber(laps, d)
    return m
  }, [laps, selectedDrivers])

  const telQueries = useQueries({
    queries: selectedDrivers.map((driver) => ({
      queryKey: ['telemetry', year, event, session, driver, lapNumbers[driver]],
      queryFn: () => api.telemetry(year, event, session, driver, lapNumbers[driver]!),
      enabled: !!(year && event && session && driver && lapNumbers[driver]),
      staleTime: Infinity,
    })),
  })

  const driverColors: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {}
    selectedDrivers.forEach((d) => {
      const res = results.find((r) => r.Abbreviation === d)
      map[d] = res ? getTeamColor(res.TeamName) : '#666666'
    })
    return map
  }, [selectedDrivers, results])

  const driverDash = useMemo(() => {
    const teamSeen = new Set<string>()
    const dash: Record<string, boolean> = {}
    for (const res of results) {
      const team = res.TeamName
      if (teamSeen.has(team)) {
        dash[res.Abbreviation] = true
      } else {
        teamSeen.add(team)
        dash[res.Abbreviation] = false
      }
    }
    return dash
  }, [results])

  const telemetryMap = useMemo(() => {
    const m = new Map<string, TelemetryPoint[]>()
    selectedDrivers.forEach((driver, i) => {
      const q = telQueries[i]
      if (q?.data) m.set(driver, q.data.filter((p) => p.Distance !== null))
    })
    return m
  }, [selectedDrivers, telQueries])

  const isAnyLoading = telQueries.some((q) => q.isLoading || q.isFetching)
  const activeDrivers = selectedDrivers.filter((d) => telemetryMap.has(d))

  function toggleChannel(ch: Channel) {
    setActiveChannels((prev) => {
      const next = new Set(prev)
      if (next.has(ch)) next.delete(ch)
      else next.add(ch)
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setChannelOrder((prev) => {
        const oldIdx = prev.indexOf(active.id as Channel)
        const newIdx = prev.indexOf(over.id as Channel)
        if (oldIdx === -1 || newIdx === -1) return prev
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  type CfgField = keyof TelemetryPoint | null
  const CHANNEL_CONFIG: Record<Exclude<Channel, 'position' | 'weather' | 'trackstatus' | 'pitstops'>, {
    field: CfgField
    domain?: [number | 'auto', number | 'auto']
    step?: boolean
    height?: number
    formatter?: (v: number) => string
  }> = {
    speed:    { field: 'Speed',    domain: [0, 'auto'],  height: 170 },
    throttle: { field: 'Throttle', domain: [0, 100],     height: 115 },
    brake:    { field: 'Brake',    domain: [0, 1.05],    height: 95,  step: true, formatter: (v) => v.toFixed(0) },
    gear:     { field: 'nGear',    domain: [0, 8],       height: 105, step: true, formatter: (v) => v.toFixed(0) },
    rpm:      { field: 'RPM',      domain: [0, 'auto'],  height: 145 },
    drs:      { field: 'DRS',      domain: [-0.5, 1.5],  height: 90,  step: true, formatter: (v) => v.toFixed(0) },
    delta:    { field: null,                             height: 130 },
  }

  // Ordered active channels per group
  const distanceChannels = channelOrder
    .filter((key) => activeChannels.has(key) && !LAP_AXIS.has(key))
    .map((key) => CHANNELS.find((c) => c.key === key)!)
    .filter(Boolean)

  const lapAxisOrder = channelOrder.filter((key) => LAP_AXIS.has(key) && activeChannels.has(key))

  const showLapSection = lapAxisOrder.length > 0
  const lastDistChannel = distanceChannels[distanceChannels.length - 1]

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Select a session to begin
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Channel toggle toolbar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border flex-shrink-0 flex-wrap">
        <span className="text-[10px] text-muted uppercase tracking-widest mr-1">Channels</span>
        {CHANNELS.map((ch) => (
          <button
            key={ch.key}
            onClick={() => toggleChannel(ch.key)}
            className={[
              'px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded transition-colors',
              activeChannels.has(ch.key)
                ? 'bg-f1red/20 text-f1red border border-f1red/40'
                : 'bg-surface text-muted border border-border hover:text-white',
            ].join(' ')}
          >
            {ch.label}
          </button>
        ))}
        {selectedDrivers.length > 0 && (
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {selectedDrivers.map((d) => (
              <div key={d} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: driverColors[d] }} />
                <span className="text-[10px] font-mono text-white">{d}</span>
                {lapNumbers[d] && (
                  <span className="text-[10px] text-muted">L{lapNumbers[d]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {selectedDrivers.length === 0 && !showLapSection && trackMaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted text-sm">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Select drivers or add a track map
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Distance-axis channels */}
            {selectedDrivers.length > 0 && isAnyLoading && activeDrivers.length === 0 ? (
              <div className="flex items-center justify-center h-40 gap-3 text-muted text-sm">
                <div className="w-5 h-5 border-2 border-f1red border-t-transparent rounded-full animate-spin" />
                Loading telemetry…
              </div>
            ) : (
              activeDrivers.length > 0 && distanceChannels.length > 0 && (
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={distanceChannels.map((c) => c.key)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3">
                      {distanceChannels.map((ch) => {
                        const isLast = ch === lastDistChannel && !showLapSection

                        if (ch.key === 'delta') {
                          return (
                            <SortableItem key="delta" id="delta">
                              <div className="px-2 py-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-[10px] font-medium text-muted uppercase tracking-wider">Gap</span>
                                  <span className="text-[10px] text-muted/60">race</span>
                                </div>
                                <RaceGapChart
                                  laps={laps ?? []}
                                  results={results}
                                  selectedDrivers={selectedDrivers}
                                  driverColors={driverColors}
                                  driverDash={driverDash}

                                />
                              </div>
                            </SortableItem>
                          )
                        }

                        const cfg = CHANNEL_CONFIG[ch.key as Exclude<Channel, 'position' | 'weather' | 'trackstatus' | 'pitstops'>]
                        if (!cfg.field) return null
                        return (
                          <SortableItem key={ch.key} id={ch.key}>
                            <TelemetryChannel
                              title={ch.label}
                              unit={ch.unit}
                              data={mergeChannelData(telemetryMap, cfg.field)}
                              drivers={activeDrivers}
                              driverColors={driverColors}
                              driverDash={driverDash}
                              height={cfg.height ?? 100}
                              domain={cfg.domain}
                              syncId="f1tel"
                              showXAxis={isLast}
                              stepLine={cfg.step}
                              formatter={cfg.formatter}
                              showMinMax={ch.key === 'speed'}
                              corners={corners}
                              registerCursor={registerCursor}
                              onCursorMove={emitCursor}
                            />
                          </SortableItem>
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            )}

            {/* Lap-axis section: Position, Weather, Track Status */}
            {showLapSection && (
              <div className={activeDrivers.length > 0 && distanceChannels.length > 0 ? 'pt-3 border-t border-border' : ''}>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={lapAxisOrder} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-3">
                      {lapAxisOrder.map((key) => {
                        if (key === 'trackstatus') {
                          return (
                            <SortableItem key="trackstatus" id="trackstatus">
                              <TrackStatusChart
                                year={year}
                                event={event}
                                session={session}
                                laps={laps ?? []}
                              />
                            </SortableItem>
                          )
                        }
                        if (key === 'position') {
                          if (!laps || selectedDrivers.length === 0) return null
                          return (
                            <SortableItem key="position" id="position">
                              <PositionChart
                                laps={laps}
                                drivers={selectedDrivers}
                                driverColors={driverColors}
                                driverDash={driverDash}
                              />
                            </SortableItem>
                          )
                        }
                        if (key === 'weather') {
                          return (
                            <SortableItem key="weather" id="weather">
                              <WeatherChart
                                year={year}
                                event={event}
                                session={session}
                                laps={laps ?? []}
                              />
                            </SortableItem>
                          )
                        }
                        if (key === 'pitstops') {
                          if (!laps || selectedDrivers.length === 0) return null
                          return (
                            <SortableItem key="pitstops" id="pitstops">
                              <PitStopChart
                                laps={laps}
                                drivers={selectedDrivers}
                                driverColors={driverColors}
                              />
                            </SortableItem>
                          )
                        }
                        return null
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {isAnyLoading && activeDrivers.length > 0 && (
              <div className="text-[10px] text-muted flex items-center gap-2 px-2 pt-1">
                <div className="w-3 h-3 border border-f1red border-t-transparent rounded-full animate-spin" />
                Fetching telemetry…
              </div>
            )}

            {activeDrivers.length === 0 && !isAnyLoading && selectedDrivers.length > 0 && !showLapSection && (
              <div className="flex items-center justify-center h-40 text-muted text-sm">
                No telemetry available for selected drivers
              </div>
            )}

            {/* Track Maps */}
            {trackMaps.length > 0 && (
              <div className={(activeDrivers.length > 0 || showLapSection) ? 'pt-3 border-t border-border' : ''}>
                <DndContext collisionDetection={closestCenter} onDragEnd={handleTrackMapDragEnd}>
                  <SortableContext items={trackMaps.map((m) => m.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 gap-3">
                      {trackMaps.map((mapState) => (
                        <SortableItem key={mapState.id} id={mapState.id}>
                          <TrackMap
                            year={year}
                            event={event}
                            session={session}
                            results={results}
                            driver={mapState.driver}
                            metric={mapState.metric}
                            onDriverChange={(d) => updateTrackMap(mapState.id, { driver: d })}
                            onMetricChange={(m) => updateTrackMap(mapState.id, { metric: m })}
                            onDelete={() => removeTrackMap(mapState.id)}
                          />
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {/* Add Track Map button */}
            <button
              onClick={addTrackMap}
              className="w-full border border-dashed border-border rounded py-2 text-[11px] text-muted hover:text-white hover:border-white/20 transition-colors"
            >
              + Add Track Map
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
