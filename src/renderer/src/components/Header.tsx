import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Moon, Sun, RotateCw, Globe, User } from 'lucide-react'
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query'
import { AWS_REGIONS } from '@shared/config'
import { serviceById } from '@shared/services'
import { api } from '../lib/ipc'
import { useAppStore } from '../store/useAppStore'
import { useCtx } from '../lib/query'
import { TimeRangePicker } from './TimeRangePicker'
import { AutoRefresh } from './AutoRefresh'
import { Select } from './Select'
import { cn } from '../lib/cn'

function pageTitle(pathname: string): string {
  if (pathname === '/') return 'Overview'
  if (pathname === '/cost') return 'Cost'
  if (pathname === '/logs' || pathname.startsWith('/logs/')) return 'Logs'
  if (pathname.startsWith('/s/')) {
    const id = pathname.slice('/s/'.length)
    return serviceById(id)?.label ?? 'Resources'
  }
  return 'CloudGaze'
}

export function Header(): JSX.Element {
  const loc = useLocation()
  const ctx = useCtx()
  const theme = useAppStore((s) => s.theme)
  const toggle = useAppStore((s) => s.toggleTheme)
  const profile = useAppStore((s) => s.profile)
  const region = useAppStore((s) => s.region)
  const setProfile = useAppStore((s) => s.setProfile)
  const setRegion = useAppStore((s) => s.setRegion)
  const setIdentity = useAppStore((s) => s.setIdentity)
  const queryClient = useQueryClient()
  const fetching = useIsFetching()

  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: () => api.listProfiles() })

  // Keep the sidebar's identity in sync with the active (profile, region).
  const idQ = useQuery({ queryKey: ['identity', ctx.profile, ctx.region], queryFn: () => api.check(ctx) })
  useEffect(() => {
    setIdentity(idQ.data?.ok ? idQ.data.identity : undefined)
  }, [idQ.data, setIdentity])

  const profileOptions = (() => {
    const names = (profilesQ.data ?? []).map((p) => p.name)
    if (!names.includes(profile)) names.unshift(profile)
    return names.map((n) => ({ value: n, label: n }))
  })()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-bg-elevated/80 px-5 backdrop-blur">
      <h1 className="text-base font-semibold text-fg">{pageTitle(loc.pathname)}</h1>
      <div className="flex items-center gap-2">
        <Select
          value={profile}
          onChange={setProfile}
          options={profileOptions}
          icon={<User className="h-3.5 w-3.5" />}
          title="AWS profile"
        />
        <Select
          value={region}
          onChange={setRegion}
          options={AWS_REGIONS.map((r) => ({ value: r.id, label: r.id }))}
          icon={<Globe className="h-3.5 w-3.5" />}
          title="AWS region"
        />
        <TimeRangePicker />
        <AutoRefresh />
        <button
          onClick={() => queryClient.invalidateQueries()}
          className="rounded-lg border border-border bg-surface-2 p-2 text-fg-muted transition hover:bg-surface-hover"
          title="Refresh now"
        >
          <RotateCw className={cn('h-4 w-4', fetching > 0 && 'animate-spin text-accent')} />
        </button>
        <button
          onClick={toggle}
          className="rounded-lg border border-border bg-surface-2 p-2 text-fg-muted transition hover:bg-surface-hover"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
