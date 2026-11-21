import { facesOfPhoto, kindOf } from '../../utils/faces'

// Gesichter eines Fotos mit Box + Name, für die Lightbox (gallery#9). ?art=tiere: Tiere (gallery#18).
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const sha = getRouterParam(event, 'sha') || ''
  if (!/^[a-f0-9]{64}$/.test(sha)) throw createError({ statusCode: 400, statusMessage: 'Ungültige ID' })
  return { sha, faces: await facesOfPhoto(sha, kindOf(event)) }
})
