/**
 * Headline metrics for the Deployed dashboard — service-level aggregates that
 * roll up across EVERY resource in a namespace via a CloudWatch metric-math
 * SEARCH expression, so we get "avg CPU across all EC2" or "total Lambda
 * invocations" in a single GetMetricData call (no per-resource enumeration).
 *
 * __PERIOD__ is substituted with the resolved period (seconds) in metrics.ts.
 */
import type { MetricSpecDTO } from '@shared/types'

function agg(fn: 'AVG' | 'SUM', namespace: string, dim: string, metric: string, stat: string): string {
  return `${fn}(SEARCH('{${namespace},${dim}} MetricName="${metric}"', '${stat}', __PERIOD__))`
}

function spec(label: string, unit: string, expression: string): MetricSpecDTO {
  return { label, unit, expression }
}

export const HEADLINE: Record<string, MetricSpecDTO[]> = {
  ec2: [
    spec('Avg CPU %', 'Percent', agg('AVG', 'AWS/EC2', 'InstanceId', 'CPUUtilization', 'Average')),
    spec('Network In', 'Bytes', agg('SUM', 'AWS/EC2', 'InstanceId', 'NetworkIn', 'Average')),
    spec('Network Out', 'Bytes', agg('SUM', 'AWS/EC2', 'InstanceId', 'NetworkOut', 'Average'))
  ],
  ebs: [
    spec('Read Ops', 'Count', agg('SUM', 'AWS/EBS', 'VolumeId', 'VolumeReadOps', 'Sum')),
    spec('Write Ops', 'Count', agg('SUM', 'AWS/EBS', 'VolumeId', 'VolumeWriteOps', 'Sum'))
  ],
  lambda: [
    spec('Invocations', 'Count', agg('SUM', 'AWS/Lambda', 'FunctionName', 'Invocations', 'Sum')),
    spec('Errors', 'Count', agg('SUM', 'AWS/Lambda', 'FunctionName', 'Errors', 'Sum')),
    spec('Throttles', 'Count', agg('SUM', 'AWS/Lambda', 'FunctionName', 'Throttles', 'Sum')),
    spec('Avg Duration', 'Milliseconds', agg('AVG', 'AWS/Lambda', 'FunctionName', 'Duration', 'Average'))
  ],
  rds: [
    spec('Avg CPU %', 'Percent', agg('AVG', 'AWS/RDS', 'DBInstanceIdentifier', 'CPUUtilization', 'Average')),
    spec('Connections', 'Count', agg('SUM', 'AWS/RDS', 'DBInstanceIdentifier', 'DatabaseConnections', 'Average')),
    spec('Read IOPS', 'Count/Second', agg('SUM', 'AWS/RDS', 'DBInstanceIdentifier', 'ReadIOPS', 'Average')),
    spec('Write IOPS', 'Count/Second', agg('SUM', 'AWS/RDS', 'DBInstanceIdentifier', 'WriteIOPS', 'Average'))
  ],
  'rds-clusters': [
    spec('Avg CPU %', 'Percent', agg('AVG', 'AWS/RDS', 'DBClusterIdentifier', 'CPUUtilization', 'Average')),
    spec('Connections', 'Count', agg('SUM', 'AWS/RDS', 'DBClusterIdentifier', 'DatabaseConnections', 'Average'))
  ],
  dynamodb: [
    spec('Consumed Read', 'Count', agg('SUM', 'AWS/DynamoDB', 'TableName', 'ConsumedReadCapacityUnits', 'Sum')),
    spec('Consumed Write', 'Count', agg('SUM', 'AWS/DynamoDB', 'TableName', 'ConsumedWriteCapacityUnits', 'Sum'))
  ],
  elasticache: [
    spec('Avg CPU %', 'Percent', agg('AVG', 'AWS/ElastiCache', 'CacheClusterId', 'CPUUtilization', 'Average')),
    spec('Connections', 'Count', agg('SUM', 'AWS/ElastiCache', 'CacheClusterId', 'CurrConnections', 'Average'))
  ],
  ecs: [
    spec('Avg CPU %', 'Percent', agg('AVG', 'AWS/ECS', 'ClusterName', 'CPUUtilization', 'Average')),
    spec('Avg Memory %', 'Percent', agg('AVG', 'AWS/ECS', 'ClusterName', 'MemoryUtilization', 'Average'))
  ],
  elbv2: [
    spec('Requests', 'Count', agg('SUM', 'AWS/ApplicationELB', 'LoadBalancer', 'RequestCount', 'Sum')),
    spec('Target 5XX', 'Count', agg('SUM', 'AWS/ApplicationELB', 'LoadBalancer', 'HTTPCode_Target_5XX_Count', 'Sum')),
    spec('Avg Response', 'Seconds', agg('AVG', 'AWS/ApplicationELB', 'LoadBalancer', 'TargetResponseTime', 'Average'))
  ],
  apigateway: [
    spec('Requests', 'Count', agg('SUM', 'AWS/ApiGateway', 'ApiId', 'Count', 'Sum')),
    spec('5XX', 'Count', agg('SUM', 'AWS/ApiGateway', 'ApiId', '5xx', 'Sum')),
    spec('Avg Latency', 'Milliseconds', agg('AVG', 'AWS/ApiGateway', 'ApiId', 'Latency', 'Average'))
  ],
  sqs: [
    spec('Messages Visible', 'Count', agg('SUM', 'AWS/SQS', 'QueueName', 'ApproximateNumberOfMessagesVisible', 'Average')),
    spec('Sent', 'Count', agg('SUM', 'AWS/SQS', 'QueueName', 'NumberOfMessagesSent', 'Sum')),
    spec('Received', 'Count', agg('SUM', 'AWS/SQS', 'QueueName', 'NumberOfMessagesReceived', 'Sum'))
  ],
  sns: [
    spec('Published', 'Count', agg('SUM', 'AWS/SNS', 'TopicName', 'NumberOfMessagesPublished', 'Sum')),
    spec('Delivered', 'Count', agg('SUM', 'AWS/SNS', 'TopicName', 'NumberOfNotificationsDelivered', 'Sum')),
    spec('Failed', 'Count', agg('SUM', 'AWS/SNS', 'TopicName', 'NumberOfNotificationsFailed', 'Sum'))
  ],
  efs: [
    spec('Total IO', 'Bytes', agg('SUM', 'AWS/EFS', 'FileSystemId', 'TotalIOBytes', 'Sum')),
    spec('Avg %IO Limit', 'Percent', agg('AVG', 'AWS/EFS', 'FileSystemId', 'PercentIOLimit', 'Average'))
  ],
  'log-groups': [
    spec('Incoming Bytes', 'Bytes', agg('SUM', 'AWS/Logs', 'LogGroupName', 'IncomingBytes', 'Sum')),
    spec('Incoming Events', 'Count', agg('SUM', 'AWS/Logs', 'LogGroupName', 'IncomingLogEvents', 'Sum'))
  ],
  stepfunctions: [
    spec('Started', 'Count', agg('SUM', 'AWS/States', 'StateMachineArn', 'ExecutionsStarted', 'Sum')),
    spec('Failed', 'Count', agg('SUM', 'AWS/States', 'StateMachineArn', 'ExecutionsFailed', 'Sum'))
  ]
}

export function headlineMetrics(service: string): MetricSpecDTO[] {
  return HEADLINE[service] ?? []
}
