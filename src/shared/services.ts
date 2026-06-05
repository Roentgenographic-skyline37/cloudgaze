/**
 * THE service catalog — the single registry that drives the sidebar nav, the
 * Overview inventory, and resource routing. Each entry is pure metadata (no
 * functions) so it's safe to import in the renderer.
 *
 * To add a service: add an entry here, implement a lister/detailer in
 * src/main/services/resources/<id>.ts, and register it in that folder's
 * index.ts. No renderer changes are required.
 */

export type ServiceCategory =
  | 'Compute'
  | 'Containers'
  | 'Storage'
  | 'Database'
  | 'Networking'
  | 'Security'
  | 'Management'
  | 'Integration'

export interface ServiceMeta {
  /** Stable id, also the route segment (/s/:id) and resource registry key. */
  id: string
  /** Sidebar + page label. */
  label: string
  /** lucide-react icon name (resolved in the renderer; falls back to Circle). */
  icon: string
  category: ServiceCategory
  /** 'regional' = fetched for the selected region; 'global' = once per account. */
  scope: 'regional' | 'global'
  /** Plural noun for empty states, e.g. "instances". */
  noun: string
  /** One-line description shown on the service page + Overview tile. */
  description: string
}

/** Display order of the categories in the sidebar. */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  'Compute',
  'Containers',
  'Storage',
  'Database',
  'Networking',
  'Security',
  'Management',
  'Integration'
]

export const SERVICES: ServiceMeta[] = [
  // --- Compute -------------------------------------------------------------
  { id: 'ec2', label: 'EC2 Instances', icon: 'Server', category: 'Compute', scope: 'regional', noun: 'instances', description: 'Virtual machines, their state, type, networking and live CPU/network metrics.' },
  { id: 'asg', label: 'Auto Scaling Groups', icon: 'Scaling', category: 'Compute', scope: 'regional', noun: 'groups', description: 'Auto Scaling groups with desired/min/max capacity and instance health.' },
  { id: 'lambda', label: 'Lambda Functions', icon: 'Zap', category: 'Compute', scope: 'regional', noun: 'functions', description: 'Serverless functions, runtime, memory and invocation/error/duration metrics.' },

  // --- Containers ----------------------------------------------------------
  { id: 'ecs', label: 'ECS Clusters', icon: 'Boxes', category: 'Containers', scope: 'regional', noun: 'clusters', description: 'Elastic Container Service clusters, services and running tasks.' },
  { id: 'eks', label: 'EKS Clusters', icon: 'Hexagon', category: 'Containers', scope: 'regional', noun: 'clusters', description: 'Managed Kubernetes clusters, version and status.' },
  { id: 'ecr', label: 'ECR Repositories', icon: 'Package', category: 'Containers', scope: 'regional', noun: 'repositories', description: 'Container image repositories and image counts.' },

  // --- Storage -------------------------------------------------------------
  { id: 's3', label: 'S3 Buckets', icon: 'Database', category: 'Storage', scope: 'global', noun: 'buckets', description: 'Object storage buckets, region, encryption and public-access posture.' },
  { id: 'ebs', label: 'EBS Volumes', icon: 'HardDrive', category: 'Storage', scope: 'regional', noun: 'volumes', description: 'Block storage volumes, size, type, IOPS and attachment.' },
  { id: 'ebs-snapshots', label: 'EBS Snapshots', icon: 'Camera', category: 'Storage', scope: 'regional', noun: 'snapshots', description: 'Volume snapshots owned by this account.' },
  { id: 'efs', label: 'EFS File Systems', icon: 'Folder', category: 'Storage', scope: 'regional', noun: 'file systems', description: 'Elastic File System shares, size and mode.' },

  // --- Database ------------------------------------------------------------
  { id: 'rds', label: 'RDS Instances', icon: 'Database', category: 'Database', scope: 'regional', noun: 'instances', description: 'Relational databases, engine, class, storage and live CloudWatch metrics.' },
  { id: 'rds-clusters', label: 'RDS / Aurora Clusters', icon: 'Database', category: 'Database', scope: 'regional', noun: 'clusters', description: 'Aurora and multi-AZ DB clusters and their members.' },
  { id: 'dynamodb', label: 'DynamoDB Tables', icon: 'Table', category: 'Database', scope: 'regional', noun: 'tables', description: 'NoSQL tables, capacity mode, item count and throughput metrics.' },
  { id: 'elasticache', label: 'ElastiCache', icon: 'MemoryStick', category: 'Database', scope: 'regional', noun: 'clusters', description: 'Redis / Memcached cache clusters and nodes.' },

  // --- Networking ----------------------------------------------------------
  { id: 'vpc', label: 'VPCs', icon: 'Network', category: 'Networking', scope: 'regional', noun: 'VPCs', description: 'Virtual private clouds, CIDR blocks and default flag.' },
  { id: 'subnet', label: 'Subnets', icon: 'Network', category: 'Networking', scope: 'regional', noun: 'subnets', description: 'Subnets, AZ, CIDR and available IP counts.' },
  { id: 'security-group', label: 'Security Groups', icon: 'ShieldHalf', category: 'Networking', scope: 'regional', noun: 'security groups', description: 'Firewall rule sets, ingress/egress rules and the VPC they belong to.' },
  { id: 'elbv2', label: 'Load Balancers', icon: 'Waypoints', category: 'Networking', scope: 'regional', noun: 'load balancers', description: 'Application / Network / Gateway load balancers and their state.' },
  { id: 'eip', label: 'Elastic IPs', icon: 'Globe', category: 'Networking', scope: 'regional', noun: 'addresses', description: 'Allocated Elastic IP addresses and what they are attached to.' },
  { id: 'route53', label: 'Route 53 Zones', icon: 'Globe2', category: 'Networking', scope: 'global', noun: 'hosted zones', description: 'DNS hosted zones and record counts.' },
  { id: 'cloudfront', label: 'CloudFront', icon: 'Globe', category: 'Networking', scope: 'global', noun: 'distributions', description: 'CDN distributions, domains, origins and status.' },
  { id: 'apigateway', label: 'API Gateway', icon: 'Webhook', category: 'Networking', scope: 'regional', noun: 'APIs', description: 'HTTP / WebSocket APIs (API Gateway v2), protocol and endpoint.' },

  // --- Security ------------------------------------------------------------
  { id: 'iam-users', label: 'IAM Users', icon: 'Users', category: 'Security', scope: 'global', noun: 'users', description: 'IAM users, creation date and last activity.' },
  { id: 'iam-roles', label: 'IAM Roles', icon: 'UserCog', category: 'Security', scope: 'global', noun: 'roles', description: 'IAM roles and their trust policies.' },
  { id: 'iam-policies', label: 'IAM Policies', icon: 'FileText', category: 'Security', scope: 'global', noun: 'policies', description: 'Customer-managed IAM policies and attachment counts.' },
  { id: 'kms', label: 'KMS Keys', icon: 'KeyRound', category: 'Security', scope: 'regional', noun: 'keys', description: 'Encryption keys, state, rotation and manager.' },
  { id: 'acm', label: 'ACM Certificates', icon: 'BadgeCheck', category: 'Security', scope: 'regional', noun: 'certificates', description: 'TLS certificates, domains, status and expiry.' },
  { id: 'secretsmanager', label: 'Secrets Manager', icon: 'Lock', category: 'Security', scope: 'regional', noun: 'secrets', description: 'Secret names and metadata (never the secret values).' },

  // --- Management ----------------------------------------------------------
  { id: 'cloudformation', label: 'CloudFormation', icon: 'Layers', category: 'Management', scope: 'regional', noun: 'stacks', description: 'Infrastructure-as-code stacks, status and drift.' },
  { id: 'cloudwatch-alarms', label: 'CloudWatch Alarms', icon: 'BellRing', category: 'Management', scope: 'regional', noun: 'alarms', description: 'Metric alarms and their current state.' },
  { id: 'log-groups', label: 'Log Groups', icon: 'ScrollText', category: 'Management', scope: 'regional', noun: 'log groups', description: 'CloudWatch Logs groups, retention and stored bytes.' },
  { id: 'ssm-parameters', label: 'SSM Parameters', icon: 'SlidersHorizontal', category: 'Management', scope: 'regional', noun: 'parameters', description: 'Systems Manager Parameter Store entries (names + metadata only).' },

  // --- Integration ---------------------------------------------------------
  { id: 'sns', label: 'SNS Topics', icon: 'Megaphone', category: 'Integration', scope: 'regional', noun: 'topics', description: 'Pub/sub notification topics and subscription counts.' },
  { id: 'sqs', label: 'SQS Queues', icon: 'Inbox', category: 'Integration', scope: 'regional', noun: 'queues', description: 'Message queues, type and approximate message depth.' },
  { id: 'stepfunctions', label: 'Step Functions', icon: 'Workflow', category: 'Integration', scope: 'regional', noun: 'state machines', description: 'State machine workflows and type.' }
]

const BY_ID = new Map(SERVICES.map((s) => [s.id, s]))

export function serviceById(id: string): ServiceMeta | undefined {
  return BY_ID.get(id)
}

export function servicesByCategory(category: ServiceCategory): ServiceMeta[] {
  return SERVICES.filter((s) => s.category === category)
}
