import { getAlbums, filterFrom, getPhotosBySha, savedAlbumEntry } from '../utils/photos'
import { getSavedAlbums } from '../utils/savedAlbums'

// Alben: gespeicherte (gallery#15, oben, neueste zuerst) + Session-Alben.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const f = filterFrom(event)
  const [albums, saved] = await Promise.all([getAlbums(cfg.awsRegion, cfg.photosTable, f), getSavedAlbums(event)])
  const mine = []
  for (const a of saved) {
    const e = savedAlbumEntry(a.name, a.person, await getPhotosBySha(cfg.awsRegion, cfg.photosTable, a.shas, f), a.created_at)
    if (e) mine.push(e)
  }
  const names = new Set(mine.map((a) => a.name))
  return [...mine, ...albums.filter((a) => !names.has(a.name))]
})
