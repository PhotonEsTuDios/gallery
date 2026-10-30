import { getTimelineMonth, herkunftFrom } from '../../utils/photos'
import { pageOf } from '../../utils/page'

// Bilder eines Monats, seitenweise (gallery#2). Weitere Seiten über ?offset=<next>.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const ym = decodeURIComponent(getRouterParam(event, 'ym') || '')
  if (!/^\d{4}-\d{2}$/.test(ym)) throw createError({ statusCode: 400, statusMessage: 'Ungültiger Monat' })
  const { total, offset, next, slice } = pageOf(event, await getTimelineMonth(cfg.awsRegion, cfg.photosTable, ym, herkunftFrom(event)))
  return { items: slice, total, offset, next }
})
