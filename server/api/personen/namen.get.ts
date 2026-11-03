import { getAllPhotos } from '../../utils/photos'
import { personCounts } from '../../utils/filter'

// Namen + Fotoanzahl für die Filter-Chips (gallery#8), über das ganze Archiv.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const cfg = useRuntimeConfig(event)
  return personCounts(await getAllPhotos(cfg.awsRegion, cfg.photosTable))
})
