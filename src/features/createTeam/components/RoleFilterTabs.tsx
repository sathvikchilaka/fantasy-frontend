import { roleLabel, type FantasyRole } from '@/fantasy/dream11Rules'

const TABS: Array<'ALL' | FantasyRole> = ['WK', 'BAT', 'AR', 'BOWL', 'ALL']

interface RoleFilterTabsProps {
  active: 'ALL' | FantasyRole
  roleCounts: Record<FantasyRole, number>
  onChange: (tab: 'ALL' | FantasyRole) => void
  showClearAll: boolean
  onClearAll: () => void
}

export function RoleFilterTabs({ active, roleCounts, onChange, showClearAll, onClearAll }: RoleFilterTabsProps) {
  return (
    <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 border-b overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = active === tab
        const count = tab === 'ALL' ? null : roleCounts[tab]
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab === 'ALL' ? 'All' : roleLabel(tab)}
            {count != null && count > 0 && (
              <span className={`text-[9px] tabular-nums ${isActive ? 'text-background/60' : 'text-muted-foreground'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
      {showClearAll && (
        <>
          <div className="w-px h-5 bg-border shrink-0 mx-0.5" />
          <button
            type="button"
            onClick={onClearAll}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            Clear
          </button>
        </>
      )}
    </div>
  )
}
