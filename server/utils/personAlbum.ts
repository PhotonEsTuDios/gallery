// Personen-Alben (gallery#15): ~100 portraitartige Fotos einer Person, zeitlich gestreut, mischbar.
// Reine Funktionen (keine AWS-Zugriffe) -> tests/personAlbum.test.ts.
//
// Portrait-Wert je Foto:  √(Gesichtsfläche im Bild) · Erkennungs-Score · Gedränge-Abzug · Qualität
// Auswahl:  Serienbilder (≤ 2 Min) auf das beste reduzieren -> nach Quartal gruppieren ->
//           Kontingent je Quartal ~ √Anzahl (dichte Phasen dominieren nicht) ->
//           innerhalb: nur die besten KEEP_SHARE, davon gewichtet zufällig (Portrait-Wert³, seed-stabil) -> chronologisch.

export interface Candidate {
  sha: string
  taken: string // ISO-Zeit, Pflicht (ohne Datum keine Zeitachse)
  area: number // Gesichtsbox w·h relativ zum Bild (0…1)
  score: number // Erkennungs-Score des Gesichts (0…1)
  faces: number // Gesichter auf dem Foto insgesamt
  quality?: number // Labeler 0…100
  blurry?: boolean
}

export const BURST_MS = 2 * 60 * 1000
export const DEFAULT_N = 100
export const KEEP_SHARE = 0.6 // je Zeitraum nur die besten 60 % nach Portrait-Wert (mindestens so viele wie das Kontingent)
export const WEIGHT_POW = 3 // Gewicht = Portrait-Wert³: große, klare Gesichter deutlich bevorzugt

export function portraitScore(c: Candidate): number {
  const crowd = 1 / (1 + 0.5 * Math.max(0, c.faces - 1))
  const quality = c.quality === undefined ? 1 : 0.6 + (0.4 * c.quality) / 100
  return Math.sqrt(Math.max(0, c.area)) * c.score * crowd * quality * (c.blurry ? 0.3 : 1)
}

/** Kleiner, schneller Zufallsgenerator mit Startwert (gleicher seed = gleiche Auswahl). */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Serienbilder: innerhalb von BURST_MS nach dem vorigen Bild nur das mit dem höchsten Portrait-Wert. */
export function dropBursts(cands: Candidate[]): Candidate[] {
  const sorted = [...cands].sort((a, b) => (a.taken < b.taken ? -1 : a.taken > b.taken ? 1 : 0))
  const out: Candidate[] = []
  let prevT = -Infinity
  for (const c of sorted) {
    const t = Date.parse(c.taken)
    const last = out[out.length - 1]
    if (last && t - prevT <= BURST_MS) {
      if (portraitScore(c) > portraitScore(last)) out[out.length - 1] = c
    } else out.push(c)
    prevT = t
  }
  return out
}

const quarterOf = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`

/** Kontingente je Gruppe ~ √Größe, Summe = n, keine Gruppe über ihre Größe (Rest wird verteilt). */
export function quotas(sizes: number[], n: number): number[] {
  const q = sizes.map(() => 0)
  let left = Math.min(n, sizes.reduce((s, x) => s + x, 0))
  while (left > 0) {
    const open = sizes.map((s, i) => (q[i] < s ? i : -1)).filter((i) => i >= 0)
    const w = open.map((i) => Math.sqrt(sizes[i]))
    const W = w.reduce((s, x) => s + x, 0)
    const share = open.map((i, k) => Math.min(sizes[i] - q[i], (left * w[k]) / W))
    let given = 0
    open.forEach((i, k) => { const g = Math.floor(share[k]); q[i] += g; given += g })
    if (given === 0) {
      // Reste einzeln an die Gruppen mit dem größten Nachkommaanteil
      const order = open.map((i, k) => [i, share[k] - Math.floor(share[k])] as const).sort((a, b) => b[1] - a[1])
      for (const [i] of order) { if (left - given <= 0) break; if (q[i] < sizes[i]) { q[i]++; given++ } }
    }
    left -= given
  }
  return q
}

/** Vorschlag: höchstens n SHAs, chronologisch (älteste zuerst). */
export function suggest(cands: Candidate[], n = DEFAULT_N, seed = 1): string[] {
  const pool = dropBursts(cands.filter((c) => c.taken))
  const groups = new Map<string, Candidate[]>()
  for (const c of pool) {
    const k = quarterOf(c.taken)
    const g = groups.get(k)
    if (g) g.push(c)
    else groups.set(k, [c])
  }
  const keys = [...groups.keys()].sort()
  const q = quotas(keys.map((k) => groups.get(k)!.length), n)
  const rand = rng(seed)
  const picked: Candidate[] = []
  keys.forEach((k, i) => {
    // gewichtete Stichprobe ohne Zurücklegen (Efraimidis–Spirakis): Schlüssel u^(1/w), die größten gewinnen
    const ranked = [...groups.get(k)!].sort((a, b) => portraitScore(b) - portraitScore(a))
    const top = ranked.slice(0, Math.max(q[i], Math.ceil(ranked.length * KEEP_SHARE)))
    const keyed = top.map((c) => ({ c, key: Math.pow(rand(), 1 / Math.max(1e-9, portraitScore(c) ** WEIGHT_POW)) }))
    keyed.sort((a, b) => b.key - a.key)
    picked.push(...keyed.slice(0, q[i]).map((x) => x.c))
  })
  return picked.sort((a, b) => (a.taken < b.taken ? -1 : 1)).map((c) => c.sha)
}
