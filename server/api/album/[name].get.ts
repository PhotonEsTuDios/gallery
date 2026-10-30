import { getAlbumPhotos, herkunftFrom } from '../../utils/photos'
import { pageOf } from '../../utils/page'

// Album-Inhalt, seitenweise (gallery#2). count = alle Medien, photos = diese Seite, next = nächster Offset.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const name = decodeURIComponent(getRouterParam(event, 'name') || '')
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Album fehlt' })

  const photos = await getAlbumPhotos(cfg.awsRegion, cfg.photosTable, name, herkunftFrom(event))
  if (!photos.length) throw createError({ statusCode: 404, statusMessage: 'Album leer' })

  const { total, offset, next, slice } = pageOf(event, photos)
  return {
    name,
    count: total,
    offset,
    next,
    photos: slice.map((p) => ({
      sha: p.sha,
      filename: p.filename,
      bytes: p.bytes,
      uploaded_at: p.uploaded_at,
      taken_at: p.taken_at,
      kind: p.kind,
    })),
  }
})
