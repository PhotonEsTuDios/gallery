import { sampleCluster } from '../../utils/faces'

// Stichprobe einer Gruppe zum Prüfen (gallery#10): 40 Gesichter, wahrscheinlich falsche zuerst.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const cluster = getRouterParam(event, 'cluster') || ''
  if (!/^c\d{4,6}$/.test(cluster)) throw createError({ statusCode: 400, statusMessage: 'Ungültige Gruppe' })
  const offset = Math.max(0, Math.min(100000, Number(getQuery(event).offset) || 0))
  return await sampleCluster(cluster, offset)
})
