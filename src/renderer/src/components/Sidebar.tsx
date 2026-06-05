import { useState, type ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { SERVICE_CATEGORIES, servicesByCategory } from '@shared/services'
import { regionLabel } from '@shared/config'
import { useAppStore } from '../store/useAppStore'
import { cn } from '../lib/cn'

type IconProps = { className?: string }

function NavIcon({ name, className }: { name: string; className?: string }): JSX.Element {
  const lib = Icons as unknown as Record<string, ComponentType<IconProps>>
  const Cmp = lib[name] ?? lib.Circle
  return <Cmp className={className} />
}

function Item({ to, icon, label, end }: { to: string; icon: string; label: string; end?: boolean }): JSX.Element {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
          isActive ? 'bg-accent-soft font-medium text-accent' : 'text-fg-muted hover:bg-surface-hover hover:text-fg'
        )
      }
    >
      <NavIcon name={icon} className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  )
}

export function Sidebar(): JSX.Element {
  const identity = useAppStore((s) => s.identity)
  const profile = useAppStore((s) => s.profile)
  const region = useAppStore((s) => s.region)
  const [filter, setFilter] = useState('')

  const f = filter.trim().toLowerCase()

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-violet text-accent-fg shadow-glow">
          <Icons.Cloud className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-fg">CloudGaze</div>
          <div className="text-[11px] text-fg-subtle">{region}</div>
        </div>
      </div>

      <div className="px-2 pb-1">
        <Item to="/" icon="LayoutDashboard" label="Overview" end />
        <Item to="/cost" icon="DollarSign" label="Cost" />
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Icons.Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter services…"
            className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-8 pr-2 text-xs text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2 pb-3">
        {SERVICE_CATEGORIES.map((cat) => {
          const services = servicesByCategory(cat).filter((s) => !f || s.label.toLowerCase().includes(f) || s.id.includes(f))
          if (!services.length) return null
          return (
            <div key={cat}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle/80">{cat}</div>
              <div className="space-y-0.5">
                {services.map((s) => (
                  <Item key={s.id} to={`/s/${s.id}`} icon={s.icon} label={s.label} />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
          <span className={cn('h-2 w-2 rounded-full', identity ? 'bg-ok' : 'bg-fg-subtle/40')} />
          <span className="truncate">{identity?.accountId ? `Account ${identity.accountId}` : 'Not connected'}</span>
        </div>
        <div className="mt-1 truncate text-[11px] text-fg-subtle/80" title={identity?.arn}>
          {profile} · {regionLabel(region)}
        </div>
      </div>
    </aside>
  )
}
