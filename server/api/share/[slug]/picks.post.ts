import { isShareAuthed, loadShare, putShareObject, shareKey } from '../../../utils/share'

// Proofs the artist would like finished (up to 5), plus an optional note. Behind the share password.
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const cfg = await loadShare(event, slug)
  if (!cfg || !isShareAuthed(event, slug)) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  const b = await readBody<Record<string, any>>(event)
  const known = new Set(cfg.proofs.map((p) => p.n))
  const record = {
    share: slug, receivedAt: new Date().toISOString(),
    favourites: Array.isArray(b?.favourites) ? b.favourites.map((x: unknown) => str(x, 8)).filter((n: string) => known.has(n)).slice(0, 5) : [],
    note: str(b?.note, 2000),
  }
  if (!record.favourites.length && !record.note) throw createError({ statusCode: 400, statusMessage: 'Nothing to send' })
  await putShareObject(event, shareKey(slug, `picks/${record.receivedAt.replace(/[:.]/g, '-')}.json`), JSON.stringify(record, null, 2), 'application/json')
  return { ok: true, receivedAt: record.receivedAt }
})
