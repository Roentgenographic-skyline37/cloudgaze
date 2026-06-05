import { RefreshCw } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Select } from './Select'

const OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '10000', label: '10s' },
  { value: '30000', label: '30s' },
  { value: '60000', label: '60s' },
  { value: '300000', label: '5m' }
]

/** Auto-refresh interval. Default OFF — AWS API calls cost money/quota. */
export function AutoRefresh(): JSX.Element {
  const ms = useAppStore((s) => s.autoRefreshMs)
  const setMs = useAppStore((s) => s.setAutoRefreshMs)
  return (
    <Select
      value={String(ms)}
      onChange={(v) => setMs(Number(v))}
      options={OPTIONS}
      icon={<RefreshCw className="h-3.5 w-3.5" />}
      title="Auto-refresh interval"
    />
  )
}
