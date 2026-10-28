import { getPicks } from '../utils/portfolio'

export default defineEventHandler(async (event) => {
  // Ändert sich bei jedem Klick – CloudFront darf das nicht cachen
  setHeader(event, 'cache-control', 'private, no-store')
  return { picks: await getPicks(event) }
})
