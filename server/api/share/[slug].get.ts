import { isShareAuthed, loadShare, presign, shareKey } from '../../utils/share'

// Share metadata; file URLs only after the share password was entered.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const cfg = await loadShare(event, slug)
  if (!cfg) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  setHeader(event, 'cache-control', 'private, no-store')
  const base = { artist: cfg.artist, title: cfg.title, session: cfg.session, expires: cfg.expires }
  if (!isShareAuthed(event, slug)) return { ...base, authed: false }

  const hero = await Promise.all(cfg.hero.map(async (h) => ({
    n: h.n, w: h.w, h: h.h, private: !!h.private, name: h.name, bytes: h.bytes,
    thumb: await presign(event, shareKey(slug, `thumb/${h.name}`)),
    web: await presign(event, shareKey(slug, `web/${h.name}`)),
    full: await presign(event, shareKey(slug, `full/${h.name}`), { download: h.name }),
  })))
  const proofs = await Promise.all(cfg.proofs.map(async (p) => ({ n: p.n, thumb: await presign(event, shareKey(slug, `proof/${p.name}`)) })))
  const zips = await Promise.all(cfg.zips.map(async (z) => ({ label: z.label, name: z.name, bytes: z.bytes,
    url: await presign(event, shareKey(slug, `dl/${z.name}`), { download: z.name }) })))
  return { ...base, authed: true, hero, proofs, zips }
})
