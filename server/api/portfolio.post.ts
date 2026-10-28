import { PILLARS, setPick, type Pillar } from '../utils/portfolio'

// Body: { sha, pillar, filename, kind } – pillar null entfernt das Foto aus der Auswahl.
export default defineEventHandler(async (event) => {
  const b = await readBody<Record<string, any>>(event)
  const sha = typeof b?.sha === 'string' ? b.sha : ''
  if (!/^[0-9a-f]{64}$/.test(sha)) throw createError({ statusCode: 400, statusMessage: 'sha fehlt' })
  const pillar = b?.pillar ?? null
  if (pillar !== null && !PILLARS.includes(pillar)) throw createError({ statusCode: 400, statusMessage: 'Unbekannte Säule' })
  const filename = typeof b?.filename === 'string' ? b.filename.slice(0, 300) : ''
  const kind = b?.kind === 'video' ? 'video' : 'photo'
  const picks = await setPick(event, sha, pillar ? { pillar: pillar as Pillar, filename, kind } : null)
  return { picks }
})
