/** EKS clusters — list + detail of version, networking and endpoint config. */
import { EKSClient, ListClustersCommand, DescribeClusterCommand } from '@aws-sdk/client-eks'
import type { Cluster } from '@aws-sdk/client-eks'
import { getClient } from '../aws'
import { field, join, mapLimit, paginate, section, stateTone } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const eks = getClient(EKSClient, ctx)
  const { items: names } = await paginate<string>(async (token) => {
    const res = await eks.send(new ListClustersCommand({ nextToken: token }))
    return { items: res.clusters ?? [], next: res.nextToken }
  })

  const clusters = await mapLimit(names, 8, async (name) => {
    const res = await eks.send(new DescribeClusterCommand({ name }))
    return res.cluster
  })

  const rows = clusters
    .filter((c): c is Cluster => Boolean(c))
    .map((c) => ({
      id: c.name ?? '',
      name: c.name ?? '',
      tags: c.tags ?? {},
      tones: { status: stateTone(c.status) },
      cells: {
        name: c.name ?? '',
        status: c.status ?? '',
        version: c.version ?? '',
        platformVersion: c.platformVersion ?? '',
        endpoint: c.endpoint ?? ''
      }
    }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'version', label: 'Version' },
      { key: 'platformVersion', label: 'Platform version' },
      { key: 'endpoint', label: 'Endpoint', kind: 'mono' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const eks = getClient(EKSClient, ctx)
  const res = await eks.send(new DescribeClusterCommand({ name: id }))
  const cluster = res.cluster
  if (!cluster) throw new Error(`EKS cluster ${id} not found in ${ctx.region}.`)

  const vpc = cluster.resourcesVpcConfig

  return {
    id,
    name: cluster.name ?? id,
    service: 'eks',
    type: 'cluster',
    region: ctx.region,
    status: cluster.status,
    statusTone: stateTone(cluster.status),
    tags: cluster.tags ?? {},
    related: vpc?.vpcId ? [{ service: 'vpc', label: 'VPC', id: vpc.vpcId }] : [],
    sections: [
      section('Cluster', [
        field('Name', cluster.name),
        field('Status', cluster.status, 'badge', { tone: stateTone(cluster.status) }),
        field('Version', cluster.version),
        field('Platform version', cluster.platformVersion),
        field('Role', cluster.roleArn, 'arn'),
        field('Created', cluster.createdAt ? new Date(cluster.createdAt).toISOString() : null, 'datetime')
      ]),
      section('Networking', [
        field('VPC', vpc?.vpcId, 'mono'),
        field('Subnets', join(vpc?.subnetIds ?? [], ', ')),
        field('Security groups', join(vpc?.securityGroupIds ?? [], ', ')),
        field('Public endpoint access', vpc?.endpointPublicAccess ?? null, 'bool'),
        field('Private endpoint access', vpc?.endpointPrivateAccess ?? null, 'bool')
      ]),
      section('Endpoint', [
        field('Endpoint', cluster.endpoint, 'mono'),
        field('Certificate authority', Boolean(cluster.certificateAuthority?.data), 'bool')
      ])
    ],
    raw: cluster
  }
}
