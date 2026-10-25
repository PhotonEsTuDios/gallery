import { isShareAuthed, loadShare, putShareObject, shareKey } from '../../../utils/share'

// Stores the artist's release as a JSON record next to the share (S3), never overwriting.
const GRANTS = ['website', 'social', 'competitions', 'print', 'promotion', 'future', 'privateFrames'] as const
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const cfg = await loadShare(event, slug)
  if (!cfg || !isShareAuthed(event, slug)) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const b = await readBody<Record<string, any>>(event)
  const grants = Object.fromEntries(GRANTS.map((g) => [g, b?.grants?.[g] === true]))
  const record = {
    share: slug, artist: cfg.artist, receivedAt: new Date().toISOString(),
    name: str(b?.name, 120), email: str(b?.email, 200), creditAs: str(b?.creditAs, 120) || cfg.artist,
    grants, wantsApproval: b?.wantsApproval === true, favourites: Array.isArray(b?.favourites) ? b.favourites.slice(0, 20).map((x: unknown) => str(x, 8)) : [],
    note: str(b?.note, 2000), signature: str(b?.signature, 120), confirmed: b?.confirmed === true,
    userAgent: str(getHeader(event, 'user-agent'), 300),
  }
  if (!record.name || !record.signature || !record.confirmed) throw createError({ statusCode: 400, statusMessage: 'Name, signature and confirmation are required' })
  await putShareObject(event, shareKey(slug, `consent/${record.receivedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(record, null, 2), 'application/json')
  return { ok: true, receivedAt: record.receivedAt }
})
