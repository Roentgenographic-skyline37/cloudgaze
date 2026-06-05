/** ECR repositories — list + detail of image scanning, mutability and tags. */
import {
  ECRClient,
  DescribeRepositoriesCommand,
  ListTagsForResourceCommand
} from '@aws-sdk/client-ecr'
import type { Repository } from '@aws-sdk/client-ecr'
import { getClient } from '../aws'
import { field, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const ecr = getClient(ECRClient, ctx)
  const { items } = await paginate<Repository>(async (token) => {
    const res = await ecr.send(new DescribeRepositoriesCommand({ nextToken: token, maxResults: 100 }))
    return { items: res.repositories ?? [], next: res.nextToken }
  })

  const rows = items.map((r) => ({
    id: r.repositoryName ?? '',
    name: r.repositoryName ?? '',
    tags: {},
    cells: {
      name: r.repositoryName ?? '',
      uri: r.repositoryUri ?? '',
      tagMutability: r.imageTagMutability ?? '',
      scanOnPush: r.imageScanningConfiguration?.scanOnPush ?? false,
      encryption: r.encryptionConfiguration?.encryptionType ?? '',
      created: r.createdAt ? new Date(r.createdAt).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'uri', label: 'URI', kind: 'mono' },
      { key: 'tagMutability', label: 'Tag mutability' },
      { key: 'scanOnPush', label: 'Scan on push', kind: 'bool' },
      { key: 'encryption', label: 'Encryption' },
      { key: 'created', label: 'Created', kind: 'ago', align: 'right' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const ecr = getClient(ECRClient, ctx)
  const res = await ecr.send(new DescribeRepositoriesCommand({ repositoryNames: [id] }))
  const repo = res.repositories?.[0]
  if (!repo) throw new Error(`ECR repository ${id} not found in ${ctx.region}.`)

  const tagsRes = repo.repositoryArn
    ? await settle(ecr.send(new ListTagsForResourceCommand({ resourceArn: repo.repositoryArn })), undefined)
    : undefined

  return {
    id,
    name: repo.repositoryName ?? id,
    service: 'ecr',
    type: 'repository',
    region: ctx.region,
    tags: tagsToRecord(tagsRes?.tags),
    sections: [
      section('Repository', [
        field('Name', repo.repositoryName),
        field('URI', repo.repositoryUri, 'mono'),
        field('Registry ID', repo.registryId),
        field('Tag mutability', repo.imageTagMutability),
        field('Scan on push', repo.imageScanningConfiguration?.scanOnPush ?? null, 'bool'),
        field('Encryption', repo.encryptionConfiguration?.encryptionType),
        field('Created', repo.createdAt ? new Date(repo.createdAt).toISOString() : null, 'datetime')
      ])
    ],
    raw: repo
  }
}
