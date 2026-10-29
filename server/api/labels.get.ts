import { getLabeled, herkunftFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getLabeled(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
})
