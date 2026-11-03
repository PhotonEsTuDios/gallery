import { runFacesActions, validateAction } from '../utils/faces'

// Benennen / Zusammenführen / Ausblenden / Gesicht raus (gallery#7/#9).
// Body: { actions: [{ mode, ... }] } (höchstens 50), Schreiben über die Lambda photon-faces.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const body = await readBody(event)
  const list = Array.isArray(body?.actions) ? body.actions : []
  if (!list.length || list.length > 50) throw createError({ statusCode: 400, statusMessage: '1–50 Aktionen' })
  return { ok: true, results: await runFacesActions(list.map(validateAction)) }
})
