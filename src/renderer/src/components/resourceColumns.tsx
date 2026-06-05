import type { ResourceColumn, ResourceRow } from '@shared/types'
import type { Column } from './ui'
import { Cell } from './Cell'

/** Map a service's generic ResourceColumns into sortable DataTable columns. */
export function toResourceColumns(cols: ResourceColumn[]): Column<ResourceRow>[] {
  return cols.map((c) => ({
    key: c.key,
    header: c.label,
    align: c.align,
    sortValue: (row: ResourceRow) => row.cells[c.key] ?? null,
    render: (row: ResourceRow) =>
      c.primary ? (
        <span className="font-medium text-fg">
          <Cell value={row.cells[c.key]} kind={c.kind} />
        </span>
      ) : (
        <Cell value={row.cells[c.key]} kind={c.kind} tone={row.tones?.[c.key]} />
      )
  }))
}
