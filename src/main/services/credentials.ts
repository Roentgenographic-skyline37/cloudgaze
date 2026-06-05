/**
 * AWS profile discovery + credential validation + in-app credential save.
 *
 * Profiles are read from the standard ~/.aws/credentials and ~/.aws/config
 * files. Validation is a cheap STS GetCallerIdentity (no special perms). The
 * in-app setup screen writes to the *standard* shared profile, exactly as the
 * AWS CLI would — nothing is stored by the app itself.
 */
import { promises as fs } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { APP } from '@shared/config'
import type { AwsCtx, AwsIdentity, AwsProfile, ConnectionStatus } from '@shared/types'
import type { SaveCredsReq } from '@shared/contract'
import { getClient, resetClients, errMsg } from './aws'

const AWS_DIR = join(homedir(), '.aws')
const CREDS_PATH = join(AWS_DIR, 'credentials')
const CONFIG_PATH = join(AWS_DIR, 'config')

// --- minimal INI read/modify ------------------------------------------------

interface Ini {
  sections: Record<string, Record<string, string>>
  order: string[]
}

function parseIni(text: string): Ini {
  const sections: Record<string, Record<string, string>> = {}
  const order: string[] = []
  let cur: string | null = null
  for (const line of text.split(/\r?\n/)) {
    const sec = line.match(/^\s*\[(.+?)\]\s*$/)
    if (sec) {
      cur = sec[1].trim()
      if (!sections[cur]) {
        sections[cur] = {}
        order.push(cur)
      }
      continue
    }
    const kv = line.match(/^\s*([^=#;]+?)\s*=\s*(.*?)\s*$/)
    if (kv && cur) sections[cur][kv[1].trim()] = kv[2]
  }
  return { sections, order }
}

function serializeIni(data: Ini): string {
  return data.order
    .map((sec) => {
      const body = Object.entries(data.sections[sec])
        .map(([k, v]) => `${k} = ${v}`)
        .join('\n')
      return `[${sec}]\n${body}\n`
    })
    .join('\n')
}

async function readIni(path: string): Promise<Ini> {
  try {
    return parseIni(await fs.readFile(path, 'utf8'))
  } catch {
    return { sections: {}, order: [] }
  }
}

async function upsertIni(path: string, section: string, kv: Record<string, string>): Promise<void> {
  const data = await readIni(path)
  if (!data.sections[section]) {
    data.sections[section] = {}
    data.order.push(section)
  }
  Object.assign(data.sections[section], kv)
  await fs.mkdir(AWS_DIR, { recursive: true })
  await fs.writeFile(path, serializeIni(data), { encoding: 'utf8', mode: 0o600 })
}

/** Config-file sections are `[default]` or `[profile NAME]`; ignore the rest. */
function profileNameFromConfigSection(section: string): string | null {
  if (section === 'default') return 'default'
  if (section.startsWith('profile ')) return section.slice('profile '.length).trim()
  return null
}

// --- public API -------------------------------------------------------------

/**
 * Discover selectable AWS profiles. Merges credentials + config files; falls
 * back to a synthetic env-based "default" when only environment credentials
 * are present so the app is still usable with `AWS_ACCESS_KEY_ID` set.
 */
export async function listProfiles(): Promise<AwsProfile[]> {
  const creds = await readIni(CREDS_PATH)
  const conf = await readIni(CONFIG_PATH)

  const found = new Map<string, AwsProfile>()

  for (const section of creds.order) {
    found.set(section, { name: section, source: 'credentials' })
  }

  for (const section of conf.order) {
    const name = profileNameFromConfigSection(section)
    if (!name) continue
    const region = conf.sections[section]?.region
    const existing = found.get(name)
    if (existing) {
      if (region && !existing.region) existing.region = region
    } else {
      const isSso = Boolean(conf.sections[section]?.sso_start_url || conf.sections[section]?.sso_session)
      found.set(name, { name, region, source: isSso ? 'sso' : 'config' })
    }
  }

  if (found.size === 0 && process.env.AWS_ACCESS_KEY_ID) {
    found.set('default', {
      name: 'default',
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION,
      source: 'env'
    })
  }

  // Sort with "default" first, then alphabetical.
  return [...found.values()].sort((a, b) => {
    if (a.name === 'default') return -1
    if (b.name === 'default') return 1
    return a.name.localeCompare(b.name)
  })
}

/** STS GetCallerIdentity — proves the (profile, region) credentials are usable. */
export async function checkCredentials(ctx: AwsCtx): Promise<ConnectionStatus> {
  try {
    const sts = getClient(STSClient, ctx)
    const id = await sts.send(new GetCallerIdentityCommand({}))
    const identity: AwsIdentity = {
      accountId: id.Account,
      arn: id.Arn,
      userId: id.UserId,
      region: ctx.region,
      profile: ctx.profile
    }
    return { ok: true, identity, profile: ctx.profile, region: ctx.region }
  } catch (e) {
    return { ok: false, profile: ctx.profile, region: ctx.region, error: errMsg(e) }
  }
}

/**
 * Persist credentials to a standard shared profile, then validate. Mirrors
 * `aws configure --profile <name>`. Used by the in-app setup screen.
 */
export async function saveCredentials(req: SaveCredsReq): Promise<ConnectionStatus> {
  const profile = (req.profile || 'default').trim()
  const region = (req.region || APP.defaultRegion).trim()
  try {
    const credKv: Record<string, string> = {
      aws_access_key_id: req.accessKeyId.trim(),
      aws_secret_access_key: req.secretAccessKey.trim()
    }
    if (req.sessionToken?.trim()) credKv.aws_session_token = req.sessionToken.trim()
    await upsertIni(CREDS_PATH, profile, credKv)

    const configSection = profile === 'default' ? 'default' : `profile ${profile}`
    await upsertIni(CONFIG_PATH, configSection, { region })

    resetClients()
    return await checkCredentials({ profile, region })
  } catch (e) {
    return { ok: false, profile, region, error: errMsg(e) }
  }
}
