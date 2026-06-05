# CloudGaze

**A local, open-source desktop app to see *everything* running in your AWS account — read-only, from your own machine.**

CloudGaze is an Electron desktop app that connects to AWS using the credentials already on your machine (`~/.aws`, env vars — exactly what the AWS CLI uses) and gives you a clean, detailed, multi-region view of your live resources across dozens of services: EC2, EBS, VPC, S3, Lambda, RDS, DynamoDB, ECS, load balancers, IAM, CloudWatch, and more — with per-resource detail, tags, raw JSON, and CloudWatch charts.

No servers to deploy. No agents to install. No secrets stored by the app. Just run it.

> **Status:** early but usable (v0.1). Broad inventory first; richer per-service metrics are landing iteratively. Contributions very welcome — adding a service is intentionally a single small file.

---

## Why

The AWS Console is powerful but slow, region-locked one-page-at-a-time, and noisy. Most "AWS dashboard" tools are SaaS that want your credentials in *their* cloud. CloudGaze is the opposite:

- **Local-first & read-only.** Your credentials never leave your machine. The app only ever issues read-only / `Describe*` / `List*` calls.
- **One-click.** If you've run `aws configure`, it just works. Pick a profile and region from the top bar.
- **Generic & complete.** A single, consistent UI for every service — list, detail, tags, raw JSON, and metrics — instead of N bespoke console pages.
- **Open source (MIT).** Built to be forked, extended, and self-hosted-by-virtue-of-being-local.

---

## How it works

```
 ┌─────────────────────────┐     AWS SDK v3 (your ~/.aws creds, per profile)
 │        CloudGaze        │ ───────────────────────────────────────────────▶  STS  (who am I)
 │   (Electron desktop)    │ ───────────────────────────────────────────────▶  EC2 / S3 / RDS / Lambda / …  (Describe*/List*)
 │                         │ ───────────────────────────────────────────────▶  CloudWatch GetMetricData  (charts)
 │   main process (Node)   │ ───────────────────────────────────────────────▶  Resource Groups Tagging API  (inventory)
 │   • memoized AWS clients │
 │   • per profile+region   │     contextBridge (no Node in the UI)
 │   • read-only only       │ ◀──────────────────────────────────────────────  React renderer (window.api)
 └─────────────────────────┘
```

- **Credentials** come from the standard AWS chain via `fromNodeProviderChain` — env vars, then `~/.aws/credentials` + `~/.aws/config`. Nothing is persisted by the app.
- **Profiles & regions** are discovered from your `~/.aws` files and switchable from the header. Clients are memoized per `(profile, region)`.
- **Everything is read-only.** There is no write path anywhere in the app.

---

## Quick start

### Run from source

```bash
npm install
npm run dev
```

If AWS is configured locally it connects automatically. Otherwise the setup screen lets you paste an access key (saved to your standard `~/.aws` profile, exactly like `aws configure` — never to the app) or run `aws configure` in a terminal and click **Re-check**.

A quick check that your shell is configured:

```bash
aws sts get-caller-identity
```

### Build / package

```bash
npm run build        # production bundle -> out/
npm run dist         # package for the current OS -> dist-app/
```

---

## What you can see

CloudGaze groups services the way you think about them:

| Category | Services |
|----------|----------|
| **Compute** | EC2 instances, Auto Scaling groups, Lambda functions |
| **Containers** | ECS clusters/services, EKS clusters, ECR repositories |
| **Storage** | S3 buckets, EBS volumes & snapshots, EFS file systems |
| **Database** | RDS instances & clusters, DynamoDB tables, ElastiCache |
| **Networking** | VPCs, subnets, security groups, ELB/ALB/NLB, Route 53, CloudFront, API Gateway |
| **Security** | IAM users/roles/policies, KMS keys, ACM certs, Secrets Manager |
| **Management** | CloudFormation stacks, CloudWatch alarms & log groups, SSM parameters |
| **Integration** | SNS topics, SQS queues, Step Functions |

For each service you get a sortable, searchable, paginated table; click any row for a detail panel with grouped attributes, tags, related resources, **live CloudWatch charts** (where the service emits metrics), and the full raw `Describe` response. An **Overview** page inventories counts across every service so you can see the whole account at a glance, and a global **time-range picker** + **auto-refresh** drive the metric charts.

---

## Security

- The app issues **only** read-only AWS API calls.
- Credentials are resolved from your machine's AWS credential chain and are **never** persisted by the app.
- The renderer has no Node.js access; all AWS access happens in the main process behind a typed `contextBridge`.
- External links open in your system browser, never in-app.

A read-only managed policy such as `ReadOnlyAccess` (or `ViewOnlyAccess`) is plenty. Services you lack permission for simply show as empty rather than breaking the app.

---

## Contributing — adding a service is one file

CloudGaze is **registry-driven**. To add a new AWS service you:

1. Add one entry to `src/shared/services.ts` (id, label, icon, category).
2. Add `src/main/services/resources/<id>.ts` implementing `list()` and `detail()` returning the generic `ResourceListResult` / `ResourceDetailResult` shapes.
3. Register it in `src/main/services/resources/index.ts`.

No renderer changes required — the generic Resource Explorer renders any service from the data it returns. See `CONTRIBUTING.md` for the full walkthrough.

## Tech

Electron · electron-vite · React 18 · TypeScript · TailwindCSS · Recharts · TanStack Query · Zustand · `@aws-sdk/*` v3.

## License

[MIT](LICENSE) © CloudGaze contributors.
