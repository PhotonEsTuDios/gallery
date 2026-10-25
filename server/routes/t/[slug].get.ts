import { getShareText, loadShare, presign, shareKey } from '../../utils/share'

// Public teaser page for a share: static HTML from S3, image placeholders swapped for
// short-lived signed URLs. Only frames listed in share.json "teaser" are ever signed.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''
  const cfg = await loadShare(event, slug)
  const html = cfg && (await getShareText(event, shareKey(slug, 'teaser.html')))
  if (!cfg || !html) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const allowed = new Set(cfg.teaser)
  const names = [...new Set([...html.matchAll(/\{\{IMG:([A-Za-z0-9_.-]+)\}\}/g)].map((m) => m[1]))]
  const urls = Object.fromEntries(await Promise.all(names.map(async (n) => [n, allowed.has(n) ? await presign(event, shareKey(slug, `web/${n}`)) : ''])))
  const out = html.replace(/\{\{IMG:([A-Za-z0-9_.-]+)\}\}/g, (_, n) => urls[n] || '').replaceAll('{{GALLERY_URL}}', `/s/${slug}`)
  setHeader(event, 'content-type', 'text/html; charset=utf-8')
  setHeader(event, 'cache-control', 'private, max-age=0, no-store')
  setHeader(event, 'x-robots-tag', 'noindex, nofollow')
  return out
})
