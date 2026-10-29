import { getTimelineIndex, herkunftFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getTimelineIndex(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
})
