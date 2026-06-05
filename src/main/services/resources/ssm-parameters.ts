/**
 * SSM Parameter Store — list + detail (metadata only).
 *
 * READ-ONLY metadata: DescribeParameters never returns parameter values, and
 * GetParameter is deliberately never called so secret/SecureString contents
 * stay private.
 */
import {
  SSMClient,
  DescribeParametersCommand,
  ListTagsForResourceCommand
} from '@aws-sdk/client-ssm'
import type { ParameterMetadata } from '@aws-sdk/client-ssm'
import { getClient } from '../aws'
import { field, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const ssm = getClient(SSMClient, ctx)
  const { items, truncated } = await paginate<ParameterMetadata>(async (token) => {
    const res = await ssm.send(new DescribeParametersCommand({ NextToken: token, MaxResults: 50 }))
    return { items: res.Parameters ?? [], next: res.NextToken }
  })

  const rows = items.map((p) => ({
    id: p.Name ?? '',
    name: p.Name ?? '',
    cells: {
      name: p.Name ?? '',
      type: p.Type ?? '',
      tier: p.Tier ?? '',
      version: p.Version ?? null,
      modified: p.LastModifiedDate ? new Date(p.LastModifiedDate).toISOString() : null,
      lastUser: p.LastModifiedUser ?? ''
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', kind: 'mono', primary: true },
      { key: 'type', label: 'Type' },
      { key: 'tier', label: 'Tier' },
      { key: 'version', label: 'Version', kind: 'number', align: 'right' },
      { key: 'modified', label: 'Modified', kind: 'ago', align: 'right' },
      { key: 'lastUser', label: 'Last user', kind: 'arn' }
    ],
    rows,
    truncated
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const ssm = getClient(SSMClient, ctx)
  const res = await ssm.send(
    new DescribeParametersCommand({
      ParameterFilters: [{ Key: 'Name', Option: 'Equals', Values: [id] }]
    })
  )
  const p = res.Parameters?.[0]
  if (!p) throw new Error(`Parameter ${id} not found in ${ctx.region}.`)

  const tagsRes = await settle(
    ssm.send(new ListTagsForResourceCommand({ ResourceType: 'Parameter', ResourceId: id })),
    undefined
  )

  return {
    id,
    name: p.Name ?? id,
    service: 'ssm-parameters',
    type: 'parameter',
    region: ctx.region,
    tags: tagsToRecord(tagsRes?.TagList),
    sections: [
      section('Parameter', [
        field('Name', p.Name, 'mono'),
        field('Type', p.Type),
        field('Tier', p.Tier),
        field('Version', p.Version ?? null, 'number'),
        field('Data type', p.DataType),
        field('Modified', p.LastModifiedDate ? new Date(p.LastModifiedDate).toISOString() : null, 'datetime'),
        field('Last user', p.LastModifiedUser, 'arn'),
        field('Description', p.Description)
      ]),
      section('Policies', [field('Count', p.Policies?.length ?? null, 'number')])
    ],
    raw: p
  }
}
