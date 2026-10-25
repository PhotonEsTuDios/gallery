import { getShareText, loadShare, putShareObject, shareKey } from '../../../utils/share'

// The artist signs the usage release on the public teaser, before she has the password.
// Open endpoint, so: honeypot, size limits and a small per-IP rate limit. The record keeps the
// exact release wording she agreed to (shares/<slug>/release.json), never overwriting old records.
type Release = { version: string; intro: string; grants: { k: string; t: string }[]; confirm: string }
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const hits = new Map<string, number[]>()

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const cfg = await loadShare(event, slug)
  if (!cfg) throw createError({ statusCode: 404, statusMessage: 'Not found' })

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000)
  if (recent.length >= 5) throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
  hits.set(ip, [...recent, now])

  const raw = await getShareText(event, shareKey(slug, 'release.json'))
  if (!raw) throw createError({ statusCode: 500, statusMessage: 'Release text missing' })
  const rel = JSON.parse(raw) as Release

  const b = await readBody<Record<string, any>>(event)
  if (str(b?.website, 200)) return { ok: true, receivedAt: new Date().toISOString() } // honeypot: pretend success
  const record = {
    share: slug, artist: cfg.artist, receivedAt: new Date().toISOString(),
    name: str(b?.name, 120), creditAs: str(b?.creditAs, 120) || cfg.artist, email: str(b?.email, 200),
    grants: Object.fromEntries(rel.grants.map((g) => [g.k, b?.grants?.[g.k] === true])),
    wantsApproval: b?.wantsApproval === true, note: str(b?.note, 2000),
    signature: str(b?.signature, 120), confirmed: b?.confirmed === true,
    release: rel, ip, userAgent: str(getHeader(event, 'user-agent'), 300),
  }
  if (!record.name || !record.signature || !record.confirmed || !/^\S+@\S+\.\S+$/.test(record.email))
    throw createError({ statusCode: 400, statusMessage: 'Name, email, signature and confirmation are required' })
  await putShareObject(event, shareKey(slug, `consent/${record.receivedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(record, null, 2), 'application/json')
  return { ok: true, receivedAt: record.receivedAt }
})
