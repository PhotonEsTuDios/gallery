import { getAlbums, filterFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getAlbums(cfg.awsRegion, cfg.photosTable, filterFrom(event))
})
