import { getClusters, facesOfCluster, splitClusters } from '../../../utils/faces'
import { getAllPhotos } from '../../../utils/photos'
import { takenOf } from '../../../utils/sessions'
import { DEFAULT_N, MAX_N, suggest, type Candidate, type Mode } from '../../../utils/personAlbum'

// Album-Vorschlag für eine Person (gallery#15): ~100 portraitartige Fotos, zeitlich gestreut.
// ?seed=<Zahl> (Neu mischen = neuer Seed) · ?n=<Anzahl, Standard 300, max 500> · ?mode=entwicklung|portraits (gallery#17)
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'private, no-store')
  const cfg = useRuntimeConfig(event)
  const person = decodeURIComponent(getRouterParam(event, 'name') || '').trim()
  const q = getQuery(event)
  const seed = Math.abs(Math.floor(Number(q.seed) || 1)) % 2 ** 31
  const n = Math.min(MAX_N, Math.max(1, Math.floor(Number(q.n) || DEFAULT_N)))
  const mode: Mode = q.mode === 'entwicklung' ? 'entwicklung' : 'portraits'
  const named = splitClusters((await getClusters()).clusters).named.find((x) => x.person === person)
  if (!named) throw createError({ statusCode: 404, statusMessage: 'Person nicht benannt' })

  // bestes Gesicht der Person je Foto (Gesichtsfläche · Score)
  const best = new Map<string, { area: number; score: number; face: number }>()
  for (const c of named.clusters) {
    for (const f of await facesOfCluster(c, 20000)) {
      if (f.person && f.person !== person) continue
      const area = f.box ? f.box[2] * f.box[3] : 0
      const score = f.score ?? 0.9
      const prev = best.get(f.sha)
      if (!prev || area * score > prev.area * prev.score) best.set(f.sha, { area, score, face: f.face })
    }
  }
  const bySha = new Map((await getAllPhotos(cfg.awsRegion, cfg.photosTable)).map((p) => [p.sha, p]))
  const cands: Candidate[] = []
  for (const [sha, f] of best) {
    const p = bySha.get(sha)
    const taken = p && takenOf(p)
    if (!p || p.kind !== 'photo' || !taken) continue
    cands.push({ sha, taken, area: f.area, score: f.score, faces: p.face_count ?? 1, quality: p.quality_score, blurry: p.blurry })
  }
  const shas = suggest(cands, n, seed, mode)
  return {
    person, seed, mode, candidates: cands.length, solo: cands.filter((c) => c.faces <= 1).length,
    photos: shas.map((sha) => { const p = bySha.get(sha)!; return { sha, face: best.get(sha)!.face, filename: p.filename, taken_at: takenOf(p), kind: p.kind } }),
  }
})
