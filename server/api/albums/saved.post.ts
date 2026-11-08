import { ALBUM_NAME_RE, MAX_SHAS, updateSavedAlbums } from '../../utils/savedAlbums'

// Album speichern / löschen (gallery#15).
// { name, person?, shas: [...] } speichert (gleicher Name = überschreiben) · { delete: name } löscht.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const body = await readBody(event)
  if (typeof body?.delete === 'string') {
    const albums = await updateSavedAlbums(event, (l) => l.filter((a) => a.name !== body.delete))
    return { ok: true, count: albums.length }
  }
  const name = String(body?.name ?? '').trim()
  const person = body?.person ? String(body.person).trim().slice(0, 60) : undefined
  const shas = Array.isArray(body?.shas) ? body.shas.map(String) : []
  if (!ALBUM_NAME_RE.test(name)) throw createError({ statusCode: 400, statusMessage: 'Ungültiger Albumname' })
  if (!shas.length || shas.length > MAX_SHAS || !shas.every((s: string) => /^[a-f0-9]{64}$/.test(s))) {
    throw createError({ statusCode: 400, statusMessage: `1–${MAX_SHAS} Fotos` })
  }
  const album = { name, person, created_at: new Date().toISOString(), shas: [...new Set<string>(shas)] }
  const albums = await updateSavedAlbums(event, (l) => [album, ...l.filter((a) => a.name !== name)])
  return { ok: true, album: { name, count: album.shas.length }, count: albums.length }
})
