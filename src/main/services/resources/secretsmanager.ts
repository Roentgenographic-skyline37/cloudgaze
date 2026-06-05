/**
 * Secrets Manager — list + detail showing metadata only. This module never
 * fetches secret material (no GetSecretValue); DescribeSecret returns config only.
 */
import { SecretsManagerClient, ListSecretsCommand, DescribeSecretCommand } from '@aws-sdk/client-secrets-manager'
import type { SecretListEntry } from '@aws-sdk/client-secrets-manager'
import { getClient } from '../aws'
import { field, join, paginate, section, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const sm = getClient(SecretsManagerClient, ctx)
  const { items, truncated } = await paginate<SecretListEntry>(async (token) => {
    const res = await sm.send(new ListSecretsCommand({ NextToken: token, MaxResults: 100 }))
    return { items: res.SecretList ?? [], next: res.NextToken }
  })

  const rows = items.map((s) => ({
    id: s.ARN ?? '',
    name: s.Name ?? '',
    cells: {
      name: s.Name ?? '',
      description: s.Description ?? '',
      lastChanged: s.LastChangedDate ? new Date(s.LastChangedDate).toISOString() : null,
      lastAccessed: s.LastAccessedDate ? new Date(s.LastAccessedDate).toISOString() : null,
      rotation: s.RotationEnabled ?? null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Secret', primary: true },
      { key: 'description', label: 'Description' },
      { key: 'lastChanged', label: 'Last changed', kind: 'ago', align: 'right' },
      { key: 'lastAccessed', label: 'Last accessed', kind: 'ago', align: 'right' },
      { key: 'rotation', label: 'Rotation', kind: 'bool' }
    ],
    rows,
    truncated
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const sm = getClient(SecretsManagerClient, ctx)
  // DescribeSecret returns metadata only — NEVER call GetSecretValue.
  const s = await sm.send(new DescribeSecretCommand({ SecretId: id }))

  return {
    id,
    name: s.Name ?? id,
    service: 'secretsmanager',
    type: 'secret',
    region: ctx.region,
    tags: tagsToRecord(s.Tags),
    sections: [
      section('Secret', [
        field('Name', s.Name),
        field('ARN', s.ARN, 'arn'),
        field('Description', s.Description),
        field('Created', s.CreatedDate ? new Date(s.CreatedDate).toISOString() : null, 'datetime'),
        field('Last changed', s.LastChangedDate ? new Date(s.LastChangedDate).toISOString() : null, 'datetime'),
        field('Last accessed', s.LastAccessedDate ? new Date(s.LastAccessedDate).toISOString() : null, 'ago')
      ]),
      section('Rotation', [
        field('Enabled', s.RotationEnabled ?? null, 'bool'),
        field('Lambda', s.RotationLambdaARN, 'arn'),
        field('Automatically after days', s.RotationRules?.AutomaticallyAfterDays ?? null, 'number')
      ]),
      section('Encryption', [field('KMS key ID', s.KmsKeyId, 'mono')]),
      section('Replication', [field('Regions', join((s.ReplicationStatus ?? []).map((r) => r.Region), ', '))])
    ],
    raw: s
  }
}
