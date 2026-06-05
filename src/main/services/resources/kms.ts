/** KMS keys — list (with alias mapping + per-key metadata) + detail. */
import {
  KMSClient,
  ListKeysCommand,
  ListAliasesCommand,
  DescribeKeyCommand,
  GetKeyRotationStatusCommand,
  ListResourceTagsCommand
} from '@aws-sdk/client-kms'
import type { KeyListEntry, AliasListEntry } from '@aws-sdk/client-kms'
import { getClient } from '../aws'
import { field, mapLimit, paginate, section, settle, stateTone, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const kms = getClient(KMSClient, ctx)

  const { items: keys, truncated } = await paginate<KeyListEntry>(async (token) => {
    const res = await kms.send(new ListKeysCommand({ Marker: token }))
    return { items: res.Keys ?? [], next: res.Truncated ? res.NextMarker : undefined }
  })

  const { items: aliases } = await paginate<AliasListEntry>(async (token) => {
    const res = await kms.send(new ListAliasesCommand({ Marker: token }))
    return { items: res.Aliases ?? [], next: res.Truncated ? res.NextMarker : undefined }
  })

  const aliasByKey = new Map<string, string>()
  for (const a of aliases) {
    if (a.TargetKeyId && a.AliasName && !aliasByKey.has(a.TargetKeyId)) aliasByKey.set(a.TargetKeyId, a.AliasName)
  }

  const described = await mapLimit(keys, 12, (k) => settle(kms.send(new DescribeKeyCommand({ KeyId: k.KeyId })), undefined))

  const rows = keys.map((k, i) => {
    const m = described[i]?.KeyMetadata
    const alias = k.KeyId ? aliasByKey.get(k.KeyId) : undefined
    const state = m?.KeyState
    return {
      id: k.KeyId ?? '',
      name: alias ?? k.KeyId ?? '',
      tones: { state: stateTone(state) },
      cells: {
        id: alias ?? k.KeyId ?? '',
        keyId: k.KeyId ?? '',
        state: state ?? '',
        manager: m?.KeyManager ?? '',
        usage: m?.KeyUsage ?? '',
        spec: m?.KeySpec ?? m?.CustomerMasterKeySpec ?? ''
      }
    }
  })

  return {
    columns: [
      { key: 'id', label: 'Key', primary: true, kind: 'mono' },
      { key: 'keyId', label: 'Key ID', kind: 'mono' },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'manager', label: 'Manager' },
      { key: 'usage', label: 'Usage' },
      { key: 'spec', label: 'Spec' }
    ],
    rows,
    truncated
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const kms = getClient(KMSClient, ctx)
  const res = await kms.send(new DescribeKeyCommand({ KeyId: id }))
  const m = res.KeyMetadata

  const rotation = await settle(kms.send(new GetKeyRotationStatusCommand({ KeyId: id })), undefined)
  const tagsRes = await settle(kms.send(new ListResourceTagsCommand({ KeyId: id })), undefined)
  const tags = tagsToRecord((tagsRes?.Tags ?? []).map((t) => ({ Key: t.TagKey, Value: t.TagValue })))

  const state = m?.KeyState

  return {
    id,
    name: m?.KeyId ?? id,
    service: 'kms',
    type: 'key',
    region: ctx.region,
    status: state,
    statusTone: stateTone(state),
    tags,
    sections: [
      section('Key', [
        field('Key ID', m?.KeyId, 'mono'),
        field('ARN', m?.Arn, 'arn'),
        field('State', state, 'badge', { tone: stateTone(state) }),
        field('Manager', m?.KeyManager),
        field('Usage', m?.KeyUsage),
        field('Spec', m?.KeySpec ?? m?.CustomerMasterKeySpec),
        field('Origin', m?.Origin)
      ]),
      section('Rotation', [field('Enabled', rotation?.KeyRotationEnabled ?? null, 'bool')]),
      section('Lifecycle', [
        field('Created', m?.CreationDate ? new Date(m.CreationDate).toISOString() : null, 'datetime'),
        field('Description', m?.Description),
        field('Multi-region', m?.MultiRegion ?? null, 'bool')
      ])
    ],
    raw: m
  }
}
