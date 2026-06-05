/**
 * Resource registry — maps every service id (see @shared/services) to the
 * module that knows how to list + detail it. This is the ONLY place that grows
 * when you add a service: drop in a `<id>.ts` exporting `list` + `detail`, then
 * wire it here. The renderer needs no changes.
 */
import type { AwsCtx, ResourceDetailResult, ResourceListResult } from '@shared/types'
import type { ResourceModule } from './util'

import * as ec2 from './ec2'
import * as asg from './asg'
import * as lambda from './lambda'
import * as ecs from './ecs'
import * as eks from './eks'
import * as ecr from './ecr'
import * as s3 from './s3'
import * as ebs from './ebs'
import * as ebsSnapshots from './ebs-snapshots'
import * as efs from './efs'
import * as rds from './rds'
import * as rdsClusters from './rds-clusters'
import * as dynamodb from './dynamodb'
import * as elasticache from './elasticache'
import * as vpc from './vpc'
import * as subnet from './subnet'
import * as securityGroup from './security-group'
import * as elbv2 from './elbv2'
import * as eip from './eip'
import * as route53 from './route53'
import * as cloudfront from './cloudfront'
import * as apigateway from './apigateway'
import * as iamUsers from './iam-users'
import * as iamRoles from './iam-roles'
import * as iamPolicies from './iam-policies'
import * as kms from './kms'
import * as acm from './acm'
import * as secretsmanager from './secretsmanager'
import * as cloudformation from './cloudformation'
import * as cloudwatchAlarms from './cloudwatch-alarms'
import * as logGroups from './log-groups'
import * as ssmParameters from './ssm-parameters'
import * as sns from './sns'
import * as sqs from './sqs'
import * as stepfunctions from './stepfunctions'

export const REGISTRY: Record<string, ResourceModule> = {
  ec2,
  asg,
  lambda,
  ecs,
  eks,
  ecr,
  s3,
  ebs,
  'ebs-snapshots': ebsSnapshots,
  efs,
  rds,
  'rds-clusters': rdsClusters,
  dynamodb,
  elasticache,
  vpc,
  subnet,
  'security-group': securityGroup,
  elbv2,
  eip,
  route53,
  cloudfront,
  apigateway,
  'iam-users': iamUsers,
  'iam-roles': iamRoles,
  'iam-policies': iamPolicies,
  kms,
  acm,
  secretsmanager,
  cloudformation,
  'cloudwatch-alarms': cloudwatchAlarms,
  'log-groups': logGroups,
  'ssm-parameters': ssmParameters,
  sns,
  sqs,
  stepfunctions
}

export function moduleFor(service: string): ResourceModule {
  const mod = REGISTRY[service]
  if (!mod) throw new Error(`Unknown service "${service}".`)
  return mod
}

export function listResource(ctx: AwsCtx, service: string): Promise<ResourceListResult> {
  return moduleFor(service).list(ctx)
}

export function resourceDetail(ctx: AwsCtx, service: string, id: string): Promise<ResourceDetailResult> {
  return moduleFor(service).detail(ctx, id)
}
