import { getNikonPhotos, herkunftFrom } from '../utils/photos'
import { pageOf } from '../utils/page'

// Kompakte Spalten-Antwort, seitenweise (gallery#2): ~35k Nikon-Bilder sprengten sonst das 6-MB-Limit.
// m = Kameramodelle (immer komplett, damit Indizes über alle Seiten gleich bleiben),
// r = [sha, filename, modelIndex, Datum YYYY-MM-DD, flags (1 = Video, 2 = unscharf)]
// Reihenfolge: jüngstes zuerst. Weitere Seiten über ?offset=<next>.
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const photos = await getNikonPhotos(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
  const m: string[] = []
  const idx = new Map<string, number>()
  for (const p of photos) if (!idx.has(p.model)) { idx.set(p.model, m.length); m.push(p.model) }
  const { total, offset, next, slice } = pageOf(event, photos)
  const r = slice.map((p) => [p.sha, p.filename, idx.get(p.model)!, (p.taken_at || '').slice(0, 10), (p.kind === 'video' ? 1 : 0) | (p.blurry ? 2 : 0)])
  return { m, r, total, offset, next }
})
