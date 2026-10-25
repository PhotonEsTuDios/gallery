import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'
import { s3, streamToBuffer } from './aws'

// Private artist shares: everything for one share lives under s3://<bucket>/shares/<slug>/.
// A share has its OWN password (scrypt hash in share.json) and its OWN cookie, scoped to
// the slug. It never grants access to the main gallery, and the main login never needs it.

export type ShareImage = { name: string; n: string; w: number; h: number; private?: boolean; bytes?: number }
export type ShareConfig = {
  slug: string; artist: string; title: string; session: string; expires?: string
  pw: { salt: string; hash: string; n: number; r: number; p: number }
  hero: ShareImage[]; proofs: { name: string; n: string }[]
  zips: { name: string; label: string; bytes: number }[]; teaser: string[]
}

const MAX_AGE_DAYS = 30
const cache = new Map<string, { at: number; cfg: ShareConfig | null }>()

export const validSlug = (s: string) => /^[a-z0-9-]{3,60}$/.test(s)
export const shareKey = (slug: string, rest: string) => `shares/${slug}/${rest}`
export const shareCookie = (slug: string) => `photon_share_${slug.replace(/-/g, '_')}`

function env(event: H3Event) {
  const cfg = useRuntimeConfig(event)
  return { region: cfg.awsRegion as string, bucket: cfg.photosBucket as string, secret: cfg.sessionSecret as string }
}

export async function loadShare(event: H3Event, slug: string): Promise<ShareConfig | null> {
  if (!validSlug(slug)) return null
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.at < 60_000) return hit.cfg
  const { region, bucket } = env(event)
  let cfg: ShareConfig | null = null
  try {
    const obj = await s3(region).send(new GetObjectCommand({ Bucket: bucket, Key: shareKey(slug, 'share.json') }))
    cfg = JSON.parse((await streamToBuffer(obj.Body)).toString('utf8'))
    if (cfg?.expires && Date.now() > Date.parse(`${cfg.expires}T23:59:59Z`)) cfg = null
  } catch { cfg = null }
  cache.set(slug, { at: Date.now(), cfg })
  return cfg
}

export function checkSharePassword(cfg: ShareConfig, input: unknown): boolean {
  if (typeof input !== 'string' || !input || input.length > 200) return false
  const { salt, hash, n, r, p } = cfg.pw
  const got = scryptSync(input, Buffer.from(salt, 'hex'), 32, { N: n, r, p, maxmem: 64 * 1024 * 1024 })
  const want = Buffer.from(hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url')

export function makeShareToken(slug: string, secret: string) {
  const payload = `s1.${slug}.${Date.now()}`
  return `${payload}.${sign(payload, secret)}`
}

export function isShareAuthed(event: H3Event, slug: string): boolean {
  const token = getCookie(event, shareCookie(slug))
  if (!token) return false
  const i = token.lastIndexOf('.')
  if (i < 0) return false
  const payload = token.slice(0, i)
  const a = Buffer.from(token.slice(i + 1))
  const b = Buffer.from(sign(payload, env(event).secret))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const [v, s, ts] = payload.split('.')
  return v === 's1' && s === slug && Date.now() - Number(ts) <= MAX_AGE_DAYS * 864e5
}

export function setShareCookie(event: H3Event, slug: string) {
  setCookie(event, shareCookie(slug), makeShareToken(slug, env(event).secret), {
    httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/', maxAge: MAX_AGE_DAYS * 86400,
  })
}

export async function presign(event: H3Event, key: string, opts: { download?: string; expires?: number } = {}) {
  const { region, bucket } = env(event)
  return getSignedUrl(s3(region), new GetObjectCommand({
    Bucket: bucket, Key: key,
    ...(opts.download ? { ResponseContentDisposition: `attachment; filename="${opts.download}"` } : {}),
  }), { expiresIn: opts.expires ?? 6 * 3600 })
}

export async function putShareObject(event: H3Event, key: string, body: string, contentType: string) {
  const { region, bucket } = env(event)
  await s3(region).send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
}

export async function getShareText(event: H3Event, key: string): Promise<string | null> {
  const { region, bucket } = env(event)
  try {
    const obj = await s3(region).send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    return (await streamToBuffer(obj.Body)).toString('utf8')
  } catch { return null }
}
