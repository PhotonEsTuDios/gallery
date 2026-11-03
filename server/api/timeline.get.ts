import { getTimelineIndex, filterFrom } from '../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  return await getTimelineIndex(cfg.awsRegion, cfg.photosTable, filterFrom(event))
})
