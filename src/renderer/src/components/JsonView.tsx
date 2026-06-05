import { useMemo, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../lib/cn'

/** Pretty-printed, copyable JSON view of a raw AWS Describe response. */
export function JsonView({ value }: { value: unknown }): JSX.Element {
  const [copied, setCopied] = useState(false)
  const text = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }, [value])

  function copy(): void {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={copy}
        className={cn(
          'absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-fg-muted transition hover:bg-surface-hover'
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <pre className="max-h-[30rem] overflow-auto rounded-lg border border-border bg-bg-elevated p-3 font-mono text-xs leading-relaxed text-fg-muted">
        {text}
      </pre>
    </div>
  )
}
