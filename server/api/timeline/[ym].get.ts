import { getTimelineMonth, filterFrom } from '../../utils/photos'
import { pageOf } from '../../utils/page'
import { KEY_RE } from '../../utils/buckets'

// Bilder eines Abschnitts (Monat 2026-08, Quartal 2026-Q3, Jahr 2026; gallery#11), seitenweise (gallery#2). Weitere Seiten über ?offset=<next>.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const ym = decodeURIComponent(getRouterParam(event, 'ym') || '')
  if (!KEY_RE.test(ym)) throw createError({ statusCode: 400, statusMessage: 'Ungültiger Abschnitt' })
  const { total, offset, next, slice } = pageOf(event, await getTimelineMonth(cfg.awsRegion, cfg.photosTable, ym, filterFrom(event)))
  return { items: slice, total, offset, next }
})
