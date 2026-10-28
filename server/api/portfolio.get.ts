import { getPicks } from '../utils/portfolio'

export default defineEventHandler(async (event) => {
  return { picks: await getPicks(event) }
})
