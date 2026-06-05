/** CloudFormation stacks — list + detail (parameters, outputs, resources, drift). */
import {
  CloudFormationClient,
  DescribeStacksCommand,
  DescribeStackResourcesCommand
} from '@aws-sdk/client-cloudformation'
import type { Stack } from '@aws-sdk/client-cloudformation'
import { getClient } from '../aws'
import { field, join, paginate, section, settle, stateTone, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const cf = getClient(CloudFormationClient, ctx)
  const { items, truncated } = await paginate<Stack>(async (token) => {
    const res = await cf.send(new DescribeStacksCommand({ NextToken: token }))
    return { items: res.Stacks ?? [], next: res.NextToken }
  })

  const rows = items.map((s) => ({
    id: s.StackName ?? '',
    name: s.StackName ?? '',
    tags: tagsToRecord(s.Tags),
    tones: { status: stateTone(s.StackStatus) },
    cells: {
      name: s.StackName ?? '',
      status: s.StackStatus ?? '',
      drift: s.DriftInformation?.StackDriftStatus ?? 'NOT_CHECKED',
      created: s.CreationTime ? new Date(s.CreationTime).toISOString() : null,
      updated: s.LastUpdatedTime ? new Date(s.LastUpdatedTime).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Stack', primary: true },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'drift', label: 'Drift' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' },
      { key: 'updated', label: 'Updated', kind: 'ago', align: 'right' }
    ],
    rows,
    truncated
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const cf = getClient(CloudFormationClient, ctx)
  const res = await cf.send(new DescribeStacksCommand({ StackName: id }))
  const s = res.Stacks?.[0]
  if (!s) throw new Error(`Stack ${id} not found in ${ctx.region}.`)

  const resources = await settle(
    cf.send(new DescribeStackResourcesCommand({ StackName: id })),
    undefined
  )

  return {
    id,
    name: s.StackName ?? id,
    service: 'cloudformation',
    type: 'stack',
    region: ctx.region,
    status: s.StackStatus,
    statusTone: stateTone(s.StackStatus),
    tags: tagsToRecord(s.Tags),
    sections: [
      section('Stack', [
        field('Name', s.StackName, 'mono'),
        field('Status', s.StackStatus, 'badge', { tone: stateTone(s.StackStatus) }),
        field('Status reason', s.StackStatusReason),
        field('Drift', s.DriftInformation?.StackDriftStatus),
        field('Created', s.CreationTime ? new Date(s.CreationTime).toISOString() : null, 'datetime'),
        field('Updated', s.LastUpdatedTime ? new Date(s.LastUpdatedTime).toISOString() : null, 'datetime')
      ]),
      section(
        'Parameters',
        (s.Parameters ?? []).map((p) => field(p.ParameterKey ?? '', p.ParameterValue ?? null))
      ),
      section(
        'Outputs',
        (s.Outputs ?? []).map((o) => field(o.OutputKey ?? '', o.OutputValue ?? null))
      ),
      section('Resources', [
        field('Count', resources?.StackResources?.length ?? null, 'number')
      ]),
      section('Capabilities', [field('Capabilities', join(s.Capabilities ?? [], ', '))])
    ],
    raw: s
  }
}
