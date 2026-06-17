type Tab = 'overview' | 'telemetry' | 'trackmap'

interface HeaderProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  telemetry: 'Telemetry',
  trackmap: 'Track Maps',
}

export default function Header({ activeTab, onTabChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-5 h-12 bg-black border-b border-border flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="font-display font-bold text-f1red text-sm tracking-widest uppercase">
          F1
        </span>
        <span className="w-px h-4 bg-border" />
        <span className="font-display font-medium text-xs tracking-widest text-white uppercase">
          Telemetry
        </span>
      </div>

      <nav className="flex gap-1">
        {(['overview', 'telemetry', 'trackmap'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={[
              'px-4 py-1.5 text-xs font-medium tracking-widest uppercase transition-colors rounded-sm',
              activeTab === tab
                ? 'bg-f1red text-white'
                : 'text-muted hover:text-white hover:bg-surface',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>
    </header>
  )
}
