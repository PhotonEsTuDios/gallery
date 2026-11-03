// Gemeinsamer Filter für alle Ansichten (gallery#8). Rein, ohne h3/AWS -> per `node --test` prüfbar.
//
// URL-Parameter (gleich in jeder Ansicht, z. B. /timeline?p=Santi,Nepo&pm=zusammen&farbe=Blau):
//   p        Personen, Komma-getrennt
//   pm       zusammen (Standard: alle auf einem Foto) | oder (mindestens eine)
//   farbe    Farbfamilien (Hauptfarbe), Komma-getrennt -> oder
//   jahr     Jahre (JJJJ), Komma-getrennt -> oder
//   herkunft dropbox,timemachine,icloud,lokal -> oder
// Zwischen den Gruppen gilt immer UND.

export const ORIGINS = ['dropbox', 'timemachine', 'icloud', 'lokal'] as const
export type Origin = (typeof ORIGINS)[number]

export const COLOR_FAMILIES = ['Rot', 'Orange', 'Braun', 'Gelb', 'Grün', 'Türkis', 'Blau', 'Lila', 'Pink', 'Weiß', 'Grau', 'Schwarz', 'Neutral'] as const

export interface Filter {
  persons: string[]
  personMode: 'and' | 'or'
  colors: Set<string>
  years: Set<string>
  origins: Set<Origin>
}

export interface Filterable {
  origins: Origin[]
  persons?: string[]
  colors?: string[]
}

const NAME_RE = /^[^<>"\\/,]{1,60}$/

function list(v: unknown): string[] {
  const raw = Array.isArray(v) ? v.join(',') : String(v ?? '')
  return [...new Set(raw.split(',').map((x) => x.trim()).filter(Boolean))]
}

/** URL-Query -> Filter; null = kein Filter aktiv (alles zeigen). Unbekanntes wird ignoriert. */
export function parseFilter(q: Record<string, unknown>): Filter | null {
  const f: Filter = {
    persons: list(q.p).filter((n) => NAME_RE.test(n)),
    personMode: String(q.pm || '') === 'oder' ? 'or' : 'and',
    colors: new Set(list(q.farbe).filter((c) => (COLOR_FAMILIES as readonly string[]).includes(c))),
    years: new Set(list(q.jahr).filter((y) => /^(19|20)\d{2}$/.test(y))),
    origins: new Set(list(q.herkunft).filter((o): o is Origin => (ORIGINS as readonly string[]).includes(o))),
  }
  return f.persons.length || f.colors.size || f.years.size || f.origins.size ? f : null
}

/** Grobe Farbfamilie eines Hex-Werts ("nach Farbe"-Filter, Labels-Ansicht). */
export function colorFamily(hex?: string): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return 'Neutral'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const v = max
  const s = max === 0 ? 0 : d / max
  let h = 0
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }
  if (h < 0) h += 360

  if (v < 0.16) return 'Schwarz'
  if (s < 0.15 && v > 0.82) return 'Weiß'
  if (s < 0.16) return 'Grau'
  if (h < 15 || h >= 345) return 'Rot'
  if (h < 45) return v < 0.55 ? 'Braun' : 'Orange'
  if (h < 70) return 'Gelb'
  if (h < 165) return 'Grün'
  if (h < 200) return 'Türkis'
  if (h < 255) return 'Blau'
  if (h < 300) return 'Lila'
  return 'Pink'
}

/** Filter anwenden. dateOf liefert das Aufnahmedatum (ISO) fürs Jahr. */
export function applyFilter<T extends Filterable>(photos: T[], f: Filter | null, dateOf: (p: T) => string | null): T[] {
  if (!f) return photos
  return photos.filter((p) => {
    if (f.origins.size && !p.origins.some((o) => f.origins.has(o))) return false
    if (f.persons.length) {
      const have = p.persons ?? []
      const hit = f.personMode === 'and' ? f.persons.every((n) => have.includes(n)) : f.persons.some((n) => have.includes(n))
      if (!hit) return false
    }
    if (f.colors.size && !f.colors.has(colorFamily((p.colors ?? [])[0]))) return false
    if (f.years.size && !f.years.has((dateOf(p) || '').slice(0, 4))) return false
    return true
  })
}

/** Zähler je Person über eine (ggf. schon gefilterte) Menge — für die Chips. */
export function personCounts(photos: Filterable[]): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const p of photos) for (const n of p.persons ?? []) m.set(n, (m.get(n) ?? 0) + 1)
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}
