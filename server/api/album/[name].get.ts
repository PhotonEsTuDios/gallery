import { getAlbumPhotos } from '../../utils/photos'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const name = decodeURIComponent(getRouterParam(event, 'name') || '')
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Album fehlt' })

  const photos = await getAlbumPhotos(cfg.awsRegion, cfg.photosTable, name)
  if (!photos.length) throw createError({ statusCode: 404, statusMessage: 'Album leer' })

  return {
    name,
    count: photos.length,
    photos: photos.map((p) => ({
      sha: p.sha,
      filename: p.filename,
      bytes: p.bytes,
      uploaded_at: p.uploaded_at,
      taken_at: p.taken_at,
    })),
  }
})
