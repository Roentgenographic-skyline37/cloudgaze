/** Auto Scaling groups — list + detail of capacity, configuration and members. */
import { AutoScalingClient, DescribeAutoScalingGroupsCommand } from '@aws-sdk/client-auto-scaling'
import type { AutoScalingGroup } from '@aws-sdk/client-auto-scaling'
import { getClient } from '../aws'
import { field, join, paginate, section, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'

async function describe(ctx: AwsCtx, names?: string[]): Promise<AutoScalingGroup[]> {
  const asg = getClient(AutoScalingClient, ctx)
  const { items } = await paginate<AutoScalingGroup>(async (token) => {
    const res = await asg.send(
      new DescribeAutoScalingGroupsCommand({
        AutoScalingGroupNames: names,
        NextToken: token,
        MaxRecords: names ? undefined : 100
      })
    )
    return { items: res.AutoScalingGroups ?? [], next: res.NextToken }
  })
  return items
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const groups = await describe(ctx)
  const rows = groups.map((g) => ({
    id: g.AutoScalingGroupName ?? '',
    name: g.AutoScalingGroupName ?? '',
    tags: tagsToRecord((g.Tags ?? []).map((t) => ({ Key: t.Key, Value: t.Value }))),
    cells: {
      name: g.AutoScalingGroupName ?? '',
      desired: g.DesiredCapacity ?? null,
      min: g.MinSize ?? null,
      max: g.MaxSize ?? null,
      instances: g.Instances?.length ?? null,
      healthCheck: g.HealthCheckType ?? ''
    }
  }))
  return {
    columns: [
      { key: 'name', label: 'Name', primary: true },
      { key: 'desired', label: 'Desired', kind: 'number', align: 'right' },
      { key: 'min', label: 'Min', kind: 'number', align: 'right' },
      { key: 'max', label: 'Max', kind: 'number', align: 'right' },
      { key: 'instances', label: 'Instances', kind: 'number', align: 'right' },
      { key: 'healthCheck', label: 'Health check' }
    ],
    rows
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const [g] = await describe(ctx, [id])
  if (!g) throw new Error(`Auto Scaling group ${id} not found in ${ctx.region}.`)

  const launchTemplate =
    g.LaunchTemplate?.LaunchTemplateName ??
    g.LaunchConfigurationName ??
    (g.MixedInstancesPolicy ? 'Mixed instances policy' : null)

  const subnetIds = (g.VPCZoneIdentifier ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    id,
    name: id,
    service: 'asg',
    type: 'auto-scaling-group',
    region: ctx.region,
    tags: tagsToRecord((g.Tags ?? []).map((t) => ({ Key: t.Key, Value: t.Value }))),
    related: subnetIds.slice(0, 4).map((s) => ({ service: 'subnet', label: 'Subnet', id: s })),
    sections: [
      section('Capacity', [
        field('Desired', g.DesiredCapacity ?? null, 'number'),
        field('Min', g.MinSize ?? null, 'number'),
        field('Max', g.MaxSize ?? null, 'number'),
        field('Instances', g.Instances?.length ?? null, 'number')
      ]),
      section('Configuration', [
        field('Launch template', launchTemplate),
        field('Availability zones', join(g.AvailabilityZones ?? [], ', ')),
        field('Health check type', g.HealthCheckType),
        field('Health check grace period', g.HealthCheckGracePeriod ?? null, 'number'),
        field('Default cooldown', g.DefaultCooldown ?? null, 'number')
      ]),
      section(
        'Instances',
        (g.Instances ?? []).map((i) =>
          field(i.InstanceId ?? '', join([i.LifecycleState, i.HealthStatus, i.AvailabilityZone]))
        )
      )
    ],
    raw: g
  }
}
