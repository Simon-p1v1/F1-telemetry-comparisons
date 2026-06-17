import type { Result } from '../types/api'
import { getTeamColor } from '../utils/colors'

interface DriverTableProps {
  results: Result[]
  selected: string[]
  session: string
  onChange: (drivers: string[]) => void
}

const RACE_SESSIONS = new Set(['R', 'S'])

export default function DriverTable({ results, selected, session, onChange }: DriverTableProps) {
  const isRace = RACE_SESSIONS.has(session)
  function toggle(code: string) {
    onChange(
      selected.includes(code) ? selected.filter((d) => d !== code) : [...selected, code],
    )
  }

  function toggleAll() {
    if (selected.length === results.length) onChange([])
    else onChange(results.map((r) => r.Abbreviation))
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <span className="text-[10px] font-medium tracking-widest text-muted uppercase">Drivers</span>
        <button
          onClick={toggleAll}
          className="text-[10px] text-muted hover:text-white transition-colors"
        >
          {selected.length === results.length ? 'None' : 'All'}
        </button>
      </div>

      <div className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0">
        {results.map((r) => {
          const checked = selected.includes(r.Abbreviation)
          const teamColor = getTeamColor(r.TeamName)
          const dns = isRace && r.Status === 'Did not start'
          const dnf = isRace && !dns && r.dnf
          return (
            <button
              key={r.Abbreviation}
              onClick={() => toggle(r.Abbreviation)}
              className={[
                'flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors w-full',
                checked ? 'bg-surface' : 'hover:bg-surface/50',
              ].join(' ')}
            >
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0 border-2 flex items-center justify-center"
                style={{
                  borderColor: checked ? teamColor : '#444',
                  backgroundColor: checked ? teamColor + '33' : 'transparent',
                }}
              >
                {checked && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4l2 2 4-4" stroke={teamColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div
                className="w-0.5 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: teamColor }}
              />
              <span
                className="font-mono text-xs font-medium w-8 flex-shrink-0"
                style={{
                  color: dns ? '#444' : dnf ? '#555' : '#ffffff',
                  textDecoration: dns ? 'line-through' : 'none',
                }}
              >
                {r.Abbreviation}
              </span>
              <span className="text-[10px] text-muted truncate flex-1">{r.TeamName}</span>
              {(r.Position !== null || r.GridPosition !== null) && (
                <span className="text-[10px] font-mono flex-shrink-0 flex items-center gap-0.5">
                  {r.GridPosition !== null && (
                    <span style={{ color: '#555' }}>P{r.GridPosition}</span>
                  )}
                  {r.GridPosition !== null && r.Position !== null && (
                    <span style={{ color: '#444' }}> →</span>
                  )}
                  {r.Position !== null && (
                    <span style={{ color: '#aaa' }}>P{r.Position}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
