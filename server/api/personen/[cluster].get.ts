import { facesOfCluster } from '../../utils/faces'

// Alle Gesichter einer Gruppe (zum Prüfen + falsche entfernen), gallery#7.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const cluster = getRouterParam(event, 'cluster') || ''
  if (!/^c\d{4,6}$/.test(cluster)) throw createError({ statusCode: 400, statusMessage: 'Ungültige Gruppe' })
  return { cluster, faces: await facesOfCluster(cluster) }
})
