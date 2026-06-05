/** CloudWatch metric alarms — list + detail (condition, state, actions). */
import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  ListTagsForResourceCommand
} from '@aws-sdk/client-cloudwatch'
import type { MetricAlarm } from '@aws-sdk/client-cloudwatch'
import { getClient } from '../aws'
import { field, join, paginate, section, settle, tagsToRecord } from './util'
import type { AwsCtx, ResourceDetailResult, ResourceListResult, Tone } from '@shared/types'

function alarmTone(state?: string): Tone {
  return state === 'ALARM' ? 'error' : state === 'OK' ? 'ok' : 'warn'
}

export async function list(ctx: AwsCtx): Promise<ResourceListResult> {
  const cw = getClient(CloudWatchClient, ctx)
  const { items, truncated } = await paginate<MetricAlarm>(async (token) => {
    const res = await cw.send(new DescribeAlarmsCommand({ NextToken: token }))
    return { items: res.MetricAlarms ?? [], next: res.NextToken }
  })

  const rows = items.map((a) => ({
    id: a.AlarmName ?? '',
    name: a.AlarmName ?? '',
    tones: { state: alarmTone(a.StateValue) },
    cells: {
      name: a.AlarmName ?? '',
      state: a.StateValue ?? '',
      metric: join([a.Namespace, a.MetricName], '/'),
      statistic: a.Statistic ?? a.ExtendedStatistic ?? '',
      threshold: join([a.ComparisonOperator, a.Threshold]),
      updated: a.StateUpdatedTimestamp ? new Date(a.StateUpdatedTimestamp).toISOString() : null
    }
  }))

  return {
    columns: [
      { key: 'name', label: 'Alarm', primary: true },
      { key: 'state', label: 'State', kind: 'badge' },
      { key: 'metric', label: 'Metric', kind: 'mono' },
      { key: 'statistic', label: 'Statistic' },
      { key: 'threshold', label: 'Threshold' },
      { key: 'updated', label: 'Updated', kind: 'ago', align: 'right' }
    ],
    rows,
    truncated
  }
}

export async function detail(ctx: AwsCtx, id: string): Promise<ResourceDetailResult> {
  const cw = getClient(CloudWatchClient, ctx)
  const res = await cw.send(new DescribeAlarmsCommand({ AlarmNames: [id] }))
  const a = res.MetricAlarms?.[0]
  if (!a) throw new Error(`Alarm ${id} not found in ${ctx.region}.`)

  const tone = alarmTone(a.StateValue)

  const tagsRes = a.AlarmArn
    ? await settle(cw.send(new ListTagsForResourceCommand({ ResourceARN: a.AlarmArn })), undefined)
    : undefined

  return {
    id,
    name: a.AlarmName ?? id,
    service: 'cloudwatch-alarms',
    type: 'alarm',
    region: ctx.region,
    status: a.StateValue,
    statusTone: tone,
    tags: tagsToRecord(tagsRes?.Tags),
    sections: [
      section('Alarm', [
        field('Name', a.AlarmName),
        field('State', a.StateValue, 'badge', { tone }),
        field('ARN', a.AlarmArn, 'arn'),
        field('Description', a.AlarmDescription),
        field('Actions enabled', a.ActionsEnabled ?? null, 'bool')
      ]),
      section('Condition', [
        field('Namespace', a.Namespace),
        field('Metric', a.MetricName),
        field('Statistic', a.Statistic ?? a.ExtendedStatistic),
        field('Period', a.Period ?? null, 'number'),
        field('Comparison', a.ComparisonOperator),
        field('Threshold', a.Threshold ?? null, 'number'),
        field('Evaluation periods', a.EvaluationPeriods ?? null, 'number')
      ]),
      section('State', [
        field('Value', a.StateValue),
        field('Reason', a.StateReason),
        field('Updated', a.StateUpdatedTimestamp ? new Date(a.StateUpdatedTimestamp).toISOString() : null, 'datetime')
      ]),
      section('Actions', [
        field('Alarm actions', join(a.AlarmActions ?? [], ', ')),
        field('OK actions', join(a.OKActions ?? [], ', '))
      ])
    ],
    raw: a
  }
}
