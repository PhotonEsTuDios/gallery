import { getOriginCounts } from '../utils/photos'

// Anzahl Fotos je Herkunft (Dropbox / Time Machine / iCloud / Lokal) für die Filterleiste
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  setHeader(event, 'cache-control', 'private, no-store')
  return await getOriginCounts(cfg.awsRegion, cfg.photosTable)
})
