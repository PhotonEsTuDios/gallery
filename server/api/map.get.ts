import { getMapPins, herkunftFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getMapPins(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
})
