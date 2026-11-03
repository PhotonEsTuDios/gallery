import { getClusters, splitClusters } from '../utils/faces'
import { pageOf } from '../utils/page'

// Personen-Seite (gallery#7): benannte Personen + unbenannte Gruppen (seitenweise, größte zuerst).
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const { generated_at, clusters } = await getClusters()
  const { named, unnamed } = splitClusters(clusters)
  const { total, offset, next, slice } = pageOf(event, unnamed, 120)
  return { generated_at, named, groups: slice, total, offset, next }
})
