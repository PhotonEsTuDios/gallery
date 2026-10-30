import { getMapPins, herkunftFrom } from '../utils/photos'
import { pageOf } from '../utils/page'

// Karten-Pins, seitenweise (gallery#2): mit der GPS-Anreicherung können es zehntausende werden.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const { pins } = await getMapPins(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
  const { total, offset, next, slice } = pageOf(event, pins)
  return { count: total, offset, next, pins: slice }
})
