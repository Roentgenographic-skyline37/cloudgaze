/** ECS clusters — list + detail with task/service counts and CloudWatch usage. */
import { ECSClient, ListClustersCommand, DescribeClustersCommand } from '@aws-sdk/client-ecs'
import type { Cluster } from '@aws-sdk/client-ecs'
import { getClient } from '../aws'
import { field, join, paginate, section, stateTone } from './util'
import type { AwsCtx, MetricSpecDTO, ResourceDetailResult, ResourceListResult } from '@shared/types'

function tagsFromCluster(cluster?: Cluster): Record<string, string> {
  const out: Record<string, string> = {}
  for (const t of cluster?.tags ?? []) {
    if (t.key) out[t.key] = t.value ?? ''
  }
  return out
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const ecs = getClient(ECSClient, ctx)
  const { items: arns } = await paginate<string>(async (token) => {
    const res = await ecs.send(new ListClustersCommand({ nextToken: token }))
    return { items: res.clusterArns ?? [], next: res.nextToken }
  })

  const clusters: Cluster[] = []
  for (let i = 0; i < arns.length; i += 100) {
    const chunk = arns.slice(i, i + 100)
    const res = await ecs.send(new DescribeClustersCommand({ clusters: chunk, include: ['STATISTICS'] }))
    clusters.push(...(res.clusters ?? []))
  }

  const rows = clusters.map((c) => ({
    id: c.clusterName ?? '',
    name: c.clusterName ?? '',
    tags: tagsFromCluster(c),
    tones: { status: stateTone(c.status) },
    cells: {
      name: c.clusterName ?? '',
      status: c.status ?? '',
      activeServices: c.activeServicesCount ?? null,
      runningTasks: c.runningTasksCount ?? null,
      pendingTasks: c.pendingTasksCount ?? null,
      instances: c.registeredContainerInstancesCount ?? null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'status', label: 'Status', kind: 'badge' },
      { key: 'activeServices', label: 'Active services', kind: 'number', align: 'right' },
      { key: 'runningTasks', label: 'Running tasks', kind: 'number', align: 'right' },
      { key: 'pendingTasks', label: 'Pending tasks', kind: 'number', align: 'right' },
      { key: 'instances', label: 'Instances', kind: 'number', align: 'right' }
    ],
    rows
  }
}

function clusterMetrics(id: string): MetricSpecDTO[] {
  const d = [{ name: 'ClusterName', value: id }]
  return [
    { label: 'CPU %', namespace: 'AWS/ECS', metricName: 'CPUUtilization', stat: 'Average', unit: 'Percent', dimensions: d },
    { label: 'Memory %', namespace: 'AWS/ECS', metricName: 'MemoryUtilization', stat: 'Average', unit: 'Percent', dimensions: d }
  ]
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const ecs = getClient(ECSClient, ctx)
  const res = await ecs.send(
    new DescribeClustersCommand({ clusters: [id], include: ['STATISTICS', 'TAGS', 'SETTINGS'] })
  )
  const cluster = res.clusters?.[0]
  if (!cluster) throw new Error(`ECS cluster ${id} not found in ${ctx.region}.`)

  return {
    id,
    name: cluster.clusterName ?? id,
    service: 'ecs',
    type: 'cluster',
    region: ctx.region,
    status: cluster.status,
    statusTone: stateTone(cluster.status),
    tags: tagsFromCluster(cluster),
    metrics: clusterMetrics(id),
    sections: [
      section('Cluster', [
        field('Name', cluster.clusterName),
        field('Status', cluster.status, 'badge', { tone: stateTone(cluster.status) }),
        field('ARN', cluster.clusterArn, 'mono')
      ]),
      section('Counts', [
        field('Active services', cluster.activeServicesCount ?? null, 'number'),
        field('Running tasks', cluster.runningTasksCount ?? null, 'number'),
        field('Pending tasks', cluster.pendingTasksCount ?? null, 'number'),
        field('Instances', cluster.registeredContainerInstancesCount ?? null, 'number')
      ]),
      section('Capacity providers', [
        field('Providers', join(cluster.capacityProviders ?? [], ', '))
      ])
    ],
    raw: cluster
  }
}
