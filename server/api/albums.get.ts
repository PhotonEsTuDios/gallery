import { getAlbums, herkunftFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getAlbums(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
})
