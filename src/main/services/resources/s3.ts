/** S3 buckets — global list with per-bucket region, detail with posture + size. */
import {
  S3Client,
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketVersioningCommand,
  GetBucketEncryptionCommand,
  GetPublicAccessBlockCommand,
  GetBucketTaggingCommand
} from '@aws-sdk/client-s3'
import { getClient } from '../aws'
import { field, mapLimit, section, settle, tagsToRecord } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

/** S3 returns '' / null for us-east-1 and 'EU' for the legacy eu-west-1. */
function normalizeRegion(loc?: string | null): string {
  if (!loc) return 'us-east-1'
  if (loc === 'EU') return 'eu-west-1'
  return loc
}

async function bucketRegion(ctx: AwsCtx, bucket: string): Promise<string> {
  const s3 = getClient(S3Client, ctx, { global: true })
  const res = await settle(s3.send(new GetBucketLocationCommand({ Bucket: bucket })), undefined as never)
  return normalizeRegion(res?.LocationConstraint)
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const s3 = getClient(S3Client, ctx, { global: true })
  const res = await s3.send(new ListBucketsCommand({}))
  const buckets = res.Buckets ?? []

  const regions = await mapLimit(buckets, 16, (b) => bucketRegion(ctx, b.Name ?? ''))

  const rows = buckets.map((b, i) => ({
    id: b.Name ?? '',
    name: b.Name ?? '',
    cells: {
      name: b.Name ?? '',
      region: regions[i],
      created: b.CreationDate ? new Date(b.CreationDate).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Bucket', primary: true, kind: 'mono' },
      { key: 'region', label: 'Region' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' }
    ],
    rows,
    note: 'S3 is a global service — the region selector does not filter this list.'
  }
}

function bucketMetrics(bucket: string): MetricSpecDTO[] {
  return [
    {
      label: 'Size (Standard)',
      namespace: 'AWS/S3',
      metricName: 'BucketSizeBytes',
      stat: 'Average',
      unit: 'Bytes',
      dimensions: [
        { name: 'BucketName', value: bucket },
        { name: 'StorageType', value: 'StandardStorage' }
      ]
    },
    {
      label: 'Object count',
      namespace: 'AWS/S3',
      metricName: 'NumberOfObjects',
      stat: 'Average',
      unit: 'Count',
      dimensions: [
        { name: 'BucketName', value: bucket },
        { name: 'StorageType', value: 'AllStorageTypes' }
      ]
    }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const s3 = getClient(S3Client, ctx, { global: true })

  const region = await bucketRegion(ctx, id)
  const versioning = await settle(s3.send(new GetBucketVersioningCommand({ Bucket: id })), undefined)
  const encryption = await settle(s3.send(new GetBucketEncryptionCommand({ Bucket: id })), undefined)
  const pab = await settle(s3.send(new GetPublicAccessBlockCommand({ Bucket: id })), undefined)
  const tagging = await settle(s3.send(new GetBucketTaggingCommand({ Bucket: id })), undefined)

  const rule = encryption?.ServerSideEncryptionConfiguration?.Rules?.[0]?.ApplyServerSideEncryptionByDefault
  const block = pab?.PublicAccessBlockConfiguration
  const allBlocked =
    block?.BlockPublicAcls && block?.IgnorePublicAcls && block?.BlockPublicPolicy && block?.RestrictPublicBuckets

  return {
    id,
    name: id,
    service: 's3',
    type: 'bucket',
    region,
    status: allBlocked ? 'Public access blocked' : 'Review public access',
    statusTone: allBlocked ? 'ok' : 'warn',
    tags: tagsToRecord(tagging?.TagSet),
    metrics: bucketMetrics(id),
    sections: [
      section('Bucket', [
        field('Name', id, 'mono'),
        field('Region', region),
        field('Versioning', versioning?.Status ?? 'Disabled'),
        field('MFA delete', versioning?.MFADelete ?? 'Disabled')
      ]),
      section('Encryption', [
        field('Default encryption', rule?.SSEAlgorithm ?? 'None', 'badge', {
          tone: rule?.SSEAlgorithm ? 'ok' : 'warn'
        }),
        field('KMS key', rule?.KMSMasterKeyID ?? null, 'mono')
      ]),
      section('Public access block', [
        field('Block public ACLs', block?.BlockPublicAcls ?? false, 'bool'),
        field('Ignore public ACLs', block?.IgnorePublicAcls ?? false, 'bool'),
        field('Block public policy', block?.BlockPublicPolicy ?? false, 'bool'),
        field('Restrict public buckets', block?.RestrictPublicBuckets ?? false, 'bool')
      ])
    ],
    raw: { region, versioning, encryption, publicAccessBlock: pab }
  }
}
