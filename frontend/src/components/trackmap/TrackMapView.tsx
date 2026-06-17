import { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import SortableItem from '../SortableItem'
import TrackMap from '../telemetry/TrackMap'
import type { Result, MetricKey } from '../../types/api'

interface TrackMapViewProps {
  year: number
  event: string
  session: string
  results: Result[]
}

type MapState = { id: string; driver: string | null; metric: MetricKey }

export default function TrackMapView({ year, event, session, results }: TrackMapViewProps) {
  const [maps, setMaps] = useState<MapState[]>([])

  const cursorRegistry = useRef(new Set<(dist: number | null) => void>())
  const registerCursor = useCallback((fn: (dist: number | null) => void) => {
    cursorRegistry.current.add(fn)
    return () => { cursorRegistry.current.delete(fn) }
  }, [])
  const emitCursor = useCallback((dist: number | null) => {
    cursorRegistry.current.forEach(fn => fn(dist))
  }, [])

  function addMap() {
    setMaps((prev) => [...prev, { id: crypto.randomUUID(), driver: null, metric: 'Speed' }])
  }
  function removeMap(id: string) {
    setMaps((prev) => prev.filter((m) => m.id !== id))
  }
  function updateMap(id: string, updates: Partial<MapState>) {
    setMaps((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
  }
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setMaps((prev) => {
        const oldIdx = prev.findIndex((m) => m.id === active.id)
        const newIdx = prev.findIndex((m) => m.id === over.id)
        if (oldIdx === -1 || newIdx === -1) return prev
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        Select a session to begin
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center px-4 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[10px] text-muted uppercase tracking-widest">Track Maps</span>
      </div>

      {/* Maps area */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="grid grid-cols-2 gap-2">
          {maps.length === 0 && (
            <div className="col-span-2 flex flex-col items-center justify-center py-16 gap-2 text-muted text-sm">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
              Add a track map to get started
            </div>
          )}

          {maps.length > 0 && (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={maps.map((m) => m.id)} strategy={rectSortingStrategy}>
                {maps.map((mapState) => (
                  <SortableItem key={mapState.id} id={mapState.id}>
                    <TrackMap
                      year={year}
                      event={event}
                      session={session}
                      results={results}
                      driver={mapState.driver}
                      metric={mapState.metric}
                      onDriverChange={(d) => updateMap(mapState.id, { driver: d })}
                      onMetricChange={(m) => updateMap(mapState.id, { metric: m })}
                      onDelete={() => removeMap(mapState.id)}
                      large
                      registerCursor={registerCursor}
                      onCursorMove={emitCursor}
                    />
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
          )}

          <button
            onClick={addMap}
            className="col-span-2 w-full border border-dashed border-border rounded py-2.5 text-[11px] text-muted hover:text-white hover:border-white/20 transition-colors"
          >
            + Add Track Map
          </button>
        </div>
      </div>
    </div>
  )
}
