import { getAllPhotos } from '../../utils/photos'
import { animalCounts, personCounts } from '../../utils/filter'
import { kindOf } from '../../utils/faces'

// Namen + Fotoanzahl für die Filter-Chips (gallery#8), über das ganze Archiv. ?art=tiere: Tiernamen (gallery#18).
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const cfg = useRuntimeConfig(event)
  const photos = await getAllPhotos(cfg.awsRegion, cfg.photosTable)
  return kindOf(event) === 'tiere' ? animalCounts(photos) : personCounts(photos)
})
