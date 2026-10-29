import { getNikonPhotos, herkunftFrom } from '../utils/photos'

// Kompakte Spalten-Antwort: ~35k Nikon-Bilder als Objekte sprengen das 6-MB-Limit der Lambda (502).
// m = Kameramodelle, r = [sha, filename, modelIndex, Datum YYYY-MM-DD, flags (1 = Video, 2 = unscharf)]
// Reihenfolge bleibt: jüngstes zuerst (vor dem Kürzen nach vollem Zeitstempel sortiert).
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const photos = await getNikonPhotos(cfg.awsRegion, cfg.photosTable, herkunftFrom(event))
  const m: string[] = []
  const idx = new Map<string, number>()
  const r = photos.map((p) => {
    let i = idx.get(p.model)
    if (i === undefined) { i = m.length; m.push(p.model); idx.set(p.model, i) }
    return [p.sha, p.filename, i, (p.taken_at || '').slice(0, 10), (p.kind === 'video' ? 1 : 0) | (p.blurry ? 2 : 0)]
  })
  return { m, r }
})
