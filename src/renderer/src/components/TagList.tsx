/** Render an AWS tag set as compact key=value chips. */
export function TagList({ tags }: { tags: Record<string, string> }): JSX.Element {
  const entries = Object.entries(tags)
  if (!entries.length) return <span className="text-sm text-fg-subtle">No tags.</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs"
        >
          <span className="font-medium text-fg-muted">{k}</span>
          {v && (
            <>
              <span className="text-fg-subtle">=</span>
              <span className="text-fg">{v}</span>
            </>
          )}
        </span>
      ))}
    </div>
  )
}
