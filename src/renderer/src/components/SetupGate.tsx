import { useEffect, useState, type ReactNode } from 'react'
import { Cloud, AlertCircle, KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { AWS_REGIONS, APP } from '@shared/config'
import type { AwsProfile } from '@shared/types'
import { api } from '../lib/ipc'
import { useAppStore } from '../store/useAppStore'
import { Select } from './Select'

type Phase = 'checking' | 'ready' | 'setup'

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text'
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}): JSX.Element {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      />
    </label>
  )
}

export function SetupGate({ children }: { children: ReactNode }): JSX.Element {
  const profile = useAppStore((s) => s.profile)
  const region = useAppStore((s) => s.region)
  const setProfile = useAppStore((s) => s.setProfile)
  const setRegion = useAppStore((s) => s.setRegion)
  const setIdentity = useAppStore((s) => s.setIdentity)

  const [phase, setPhase] = useState<Phase>('checking')
  const [error, setError] = useState<string | undefined>()
  const [profiles, setProfiles] = useState<AwsProfile[]>([])
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secret, setSecret] = useState('')
  const [sessionToken, setSessionToken] = useState('')
  const [newProfile, setNewProfile] = useState('default')
  const [saving, setSaving] = useState(false)

  async function check(): Promise<void> {
    const { profile: p, region: r } = useAppStore.getState()
    setPhase('checking')
    setError(undefined)
    const res = await api.check({ profile: p, region: r })
    if (res.ok) {
      setIdentity(res.identity)
      setPhase('ready')
    } else {
      setError(res.error)
      setPhase('setup')
    }
  }

  useEffect(() => {
    void (async () => {
      const ps = await api.listProfiles()
      setProfiles(ps)
      const current = useAppStore.getState().profile
      if (ps.length && !ps.some((x) => x.name === current)) {
        setProfile(ps[0].name)
        if (ps[0].region) setRegion(ps[0].region)
      }
      await check()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(): Promise<void> {
    setSaving(true)
    setError(undefined)
    try {
      const res = await api.saveCreds({
        accessKeyId,
        secretAccessKey: secret,
        sessionToken: sessionToken.trim() || undefined,
        region,
        profile: newProfile
      })
      if (res.ok) {
        setProfile(newProfile)
        setIdentity(res.identity)
        setPhase('ready')
      } else {
        setError(res.error ?? 'Those credentials were rejected.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (phase === 'ready') return <>{children}</>

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg p-6 text-fg">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-violet text-accent-fg shadow-glow">
            <Cloud className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">CloudGaze</h1>
            <p className="text-xs text-fg-subtle">{APP.tagline} · read-only</p>
          </div>
        </div>

        {phase === 'checking' ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface p-6 text-sm text-fg-muted shadow-card">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking AWS credentials…
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error ? `AWS credentials not usable: ${error}` : 'No usable AWS credentials found.'}</span>
            </div>

            {profiles.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-sm text-fg-muted">
                  Pick a profile and region, then re-check — CloudGaze uses the credentials already on your machine.
                  Temporary credentials (SSO, assume-role, session-token) are supported.
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={profile}
                    onChange={setProfile}
                    options={profiles.map((p) => ({
                      value: p.name,
                      label:
                        p.source === 'sso'
                          ? `${p.name} (SSO)`
                          : p.temporary
                            ? `${p.name} (temp)`
                            : p.name
                    }))}
                    className="flex-1"
                  />
                  <Select
                    value={region}
                    onChange={setRegion}
                    options={AWS_REGIONS.map((r) => ({ value: r.id, label: r.id }))}
                    className="flex-1"
                  />
                  <button
                    onClick={() => void check()}
                    className="shrink-0 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted transition hover:bg-surface-hover"
                  >
                    Re-check
                  </button>
                </div>
                {profiles.find((p) => p.name === profile)?.source === 'sso' && (
                  <p className="mt-2 text-[11px] text-fg-subtle">
                    SSO profile — if the session has expired, run{' '}
                    <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[10px] text-fg">
                      aws sso login --profile {profile}
                    </code>{' '}
                    in a terminal, then re-check.
                  </p>
                )}
              </div>
            )}

            <details className="group" open={profiles.length === 0}>
              <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-fg-subtle">
                Or paste credentials (permanent or temporary)
              </summary>
              <p className="mb-3 mt-2 text-xs leading-relaxed text-fg-muted">
                Saved to your standard{' '}
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">~/.aws</code> profile
                (exactly like <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">aws configure</code>),
                never to this app. For temporary credentials (from the AWS SSO Access Portal, federation,
                or <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">aws sts assume-role</code>),
                paste the <strong>session token</strong> too.
              </p>
              <div className="space-y-2.5">
                <Field label="Profile name" value={newProfile} onChange={setNewProfile} placeholder="default" />
                <Field
                  label="Access Key ID"
                  value={accessKeyId}
                  onChange={setAccessKeyId}
                  placeholder="AKIA… (or ASIA… for temporary)"
                />
                <Field
                  label="Secret Access Key"
                  value={secret}
                  onChange={setSecret}
                  placeholder="••••••••••••••••"
                  type="password"
                />
                <Field
                  label="Session Token (only for temporary credentials)"
                  value={sessionToken}
                  onChange={setSessionToken}
                  placeholder="leave empty for permanent credentials"
                  type="password"
                />
                <Field label="Region" value={region} onChange={setRegion} placeholder="us-east-1" />
              </div>
              <button
                onClick={() => void save()}
                disabled={saving || !accessKeyId || !secret}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Save &amp; connect
              </button>
            </details>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-fg-subtle">
              <ShieldCheck className="h-3.5 w-3.5" /> Read-only access. Credentials never leave your machine.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
