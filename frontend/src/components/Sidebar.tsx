import { useEvents } from '../hooks/useEvents'
import { useResults } from '../hooks/useResults'
import { extractSessions } from '../utils/telemetryMath'
import DriverTable from './DriverTable'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 9 }, (_, i) => CURRENT_YEAR - i)

interface SidebarProps {
  year: number
  event: string
  session: string
  selectedDrivers: string[]
  onYearChange: (y: number) => void
  onEventChange: (e: string) => void
  onSessionChange: (s: string) => void
  onDriversChange: (d: string[]) => void
  showSessionControls?: boolean
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium tracking-widest text-muted uppercase mb-1 block">
      {children}
    </span>
  )
}

function Select({
  value,
  onChange,
  disabled,
  children,
}: {
  value: string | number
  onChange: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-surface border border-border text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-f1red disabled:opacity-40 cursor-pointer"
    >
      {children}
    </select>
  )
}

export default function Sidebar({
  year,
  event,
  session,
  selectedDrivers,
  onYearChange,
  onEventChange,
  onSessionChange,
  onDriversChange,
  showSessionControls = true,
}: SidebarProps) {
  const { data: events, isLoading: eventsLoading, error: eventsError } = useEvents(year)
  const { data: results, isLoading: resultsLoading } = useResults(year, event, session)

  const selectedEvent = events?.find((e) => e.EventName === event)
  const sessions = selectedEvent ? extractSessions(selectedEvent) : []

  function handleYearChange(v: string) {
    onYearChange(Number(v))
    onEventChange('')
    onSessionChange('')
    onDriversChange([])
  }

  function handleEventChange(v: string) {
    onEventChange(v)
    onSessionChange('')
    onDriversChange([])
  }

  function handleSessionChange(v: string) {
    onSessionChange(v)
    onDriversChange([])
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-panel border-r border-border flex flex-col gap-4 p-4 overflow-y-auto">
      <div>
        <Label>Season</Label>
        <Select value={year} onChange={handleYearChange}>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      {showSessionControls && (
        <>
          <div>
            <Label>Event</Label>
            {eventsLoading ? (
              <div className="text-xs text-muted animate-pulse">Loading events…</div>
            ) : eventsError ? (
              <div className="text-xs text-red-400">Failed to load events</div>
            ) : (
              <Select value={event} onChange={handleEventChange} disabled={!events?.length}>
                <option value="">— Select event —</option>
                {events?.map((e) => (
                  <option key={e.RoundNumber} value={e.EventName}>
                    {e.RoundNumber}. {e.EventName}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label>Session</Label>
            <Select value={session} onChange={handleSessionChange} disabled={!sessions.length}>
              <option value="">— Select session —</option>
              {sessions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="border-t border-border pt-4 flex-1 min-h-0 flex flex-col">
            {resultsLoading && session ? (
              <div className="text-xs text-muted animate-pulse">Loading drivers…</div>
            ) : results?.length ? (
              <DriverTable
                results={results}
                selected={selectedDrivers}
                session={session}
                onChange={onDriversChange}
              />
            ) : (
              <div className="text-xs text-muted">
                {session ? 'No driver data' : 'Select a session to see drivers'}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
