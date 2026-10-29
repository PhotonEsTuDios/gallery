import { getNikonPhotos, herkunftFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getNikonPhotos(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
})
