import { getTimelineMonth, herkunftFrom } from '../../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const ym = decodeURIComponent(getRouterParam(event, 'ym') || '')
  if (!/^\d{4}-\d{2}$/.test(ym)) throw createError({ statusCode: 400, statusMessage: 'Ungültiger Monat' })
  return await getTimelineMonth(cfg.awsRegion, cfg.photosTable, ym, herkunftFrom(event))
})
