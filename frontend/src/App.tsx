import { useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import OverviewView from './components/overview/OverviewView'
import TelemetryView from './components/telemetry/TelemetryView'
import TrackMapView from './components/trackmap/TrackMapView'
import { useResults } from './hooks/useResults'

type Tab = 'overview' | 'telemetry' | 'trackmap'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('telemetry')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [event, setEvent] = useState<string>('')
  const [session, setSession] = useState<string>('')
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([])

  const { data: results } = useResults(year, event, session)

  return (
    <div className="flex flex-col h-screen bg-f1dark overflow-hidden">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          year={year}
          event={event}
          session={session}
          selectedDrivers={selectedDrivers}
          onYearChange={setYear}
          onEventChange={setEvent}
          onSessionChange={setSession}
          onDriversChange={setSelectedDrivers}
          showSessionControls={activeTab !== 'overview'}
        />

        <main className="flex-1 flex min-h-0 overflow-hidden">
          {activeTab === 'overview' ? (
            <OverviewView year={year} />
          ) : activeTab === 'telemetry' ? (
            <TelemetryView
              year={year}
              event={event}
              session={session}
              selectedDrivers={selectedDrivers}
              results={results ?? []}
            />
          ) : (
            <TrackMapView
              year={year}
              event={event}
              session={session}
              results={results ?? []}
            />
          )}
        </main>
      </div>
    </div>
  )
}
