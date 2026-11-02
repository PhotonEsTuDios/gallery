// Sessions statt Jahres-Klumpen (staubsauger#8).
// Lose Bilder (Handy-Uploads, Time-Machine-Mediathek) landeten bisher alle in
// "Schnappschüsse JJJJ" (bis 9.151 Bilder in einem Album). Jetzt werden sie nach
// Aufnahmezeit zu Sessions gebündelt:
//   - Lücke > GAP_H Stunden = neue Session
//   - zwei Sessions mit weniger als MERGE_H Stunden Abstand (über Nacht) = ein Ereignis
//     (Reise, Shooting über zwei Tage); getrennte Tage mit Pause bleiben getrennt
//   - Ereignisse mit weniger als MIN_N Medien wandern in einen Monats-Topf
//     ("Schnappschüsse Juni 2024"), damit nicht tausende Mini-Alben entstehen
// Gemessen am Archiv (Okt. 2026): 73.988 lose Bilder -> ~1.330 Session-Alben + ~170
// Monats-Töpfe, größtes Album 936 statt 9.151, kein Album länger als 4 Tage.
import type { Photo } from './photos'

export const GAP_H = 4
export const MERGE_H = 12
export const MIN_N = 10

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.']

// Aufnahmezeit: taken_at (EXIF) oder Zeitstempel aus dem Dropbox-Dateinamen
// ("2024-06-23 10.38.06.jpg"), sonst null. Als "JJJJ-MM-TTTHH:MM:SS" (lokale Zeit).
const FN_TS = /(\d{4})-(\d{2})-(\d{2}) (\d{2})\.(\d{2})\.(\d{2})/
export function takenOf(p: { taken_at?: string | null; filename?: string }): string | null {
  const t = p.taken_at
  if (t && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) return t.slice(0, 19)
  const m = FN_TS.exec(p.filename || '')
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`
  return null
}

function epoch(iso: string): number {
  return Date.parse(iso + 'Z') // als UTC lesen: nur Abstände zählen, Zeitzone egal
}

// "23. Juni 2024" / "27.–28. Juli 2023" / "31. Dez. 2012 – 2. Jan. 2013"
export function rangeLabel(fromIso: string, toIso: string): string {
  const [fy, fm, fd] = fromIso.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = toIso.slice(0, 10).split('-').map(Number)
  if (fy === ty && fm === tm && fd === td) return `${fd}. ${MONTHS_DE[fm - 1]} ${fy}`
  if (fy === ty && fm === tm) return `${fd}.–${td}. ${MONTHS_DE[fm - 1]} ${fy}`
  if (fy === ty) return `${fd}. ${MONTHS_SHORT[fm - 1]} – ${td}. ${MONTHS_SHORT[tm - 1]} ${fy}`
  return `${fd}. ${MONTHS_SHORT[fm - 1]} ${fy} – ${td}. ${MONTHS_SHORT[tm - 1]} ${ty}`
}

export function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 7).split('-').map(Number)
  return `Schnappschüsse ${MONTHS_DE[m - 1]} ${y}`
}

// Kamera-Zusatz, wenn ein Ereignis klar ein Shooting ist (≥ 70 % eine Systemkamera):
// "23. Juni 2024 · Nikon Z 6_2". Handys bleiben ohne Zusatz.
const SYSTEM_CAMERA = /nikon|fujifilm|canon|sony|ilce|panasonic|olympus|leica/i
function cameraTag(items: Photo[]): string {
  const counts = new Map<string, number>()
  for (const p of items) {
    if (!SYSTEM_CAMERA.test(`${p.camera_make ?? ''} ${p.camera_model ?? ''}`)) continue
    // "NIKON D90" -> "Nikon D90"; andere Modelle tragen die Marke schon lesbar im Namen
    const name = (p.camera_model ?? p.camera_make ?? '').trim().replace(/^NIKON\s+/i, 'Nikon ')
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  let best = '', n = 0
  for (const [k, v] of counts) if (v > n) { best = k; n = v }
  return best && n >= items.length * 0.7 ? ` · ${best}` : ''
}

// Weist allen "losen" Fotos (loose(p) === true) ein Session-Album zu und schreibt es in p.album.
// Fotos ohne jede Aufnahmezeit behalten ihr bisheriges Album ("Schnappschüsse JJJJ" nach Upload-Jahr).
export function assignSessions(photos: Photo[], loose: (p: Photo) => boolean): void {
  const dated: { t: number; iso: string; p: Photo }[] = []
  for (const p of photos) {
    if (!loose(p)) continue
    const iso = takenOf(p)
    if (!iso) continue
    const t = epoch(iso)
    if (!Number.isFinite(t)) continue
    dated.push({ t, iso, p })
  }
  dated.sort((a, b) => a.t - b.t)

  // 1. Sessions (Lücke > GAP_H), 2. über Nacht zusammenlegen (< MERGE_H)
  const events: (typeof dated)[] = []
  let cur: typeof dated = []
  for (const d of dated) {
    const last = cur[cur.length - 1]
    if (last && d.t - last.t > GAP_H * 3600_000) {
      const prev = events[events.length - 1]
      if (prev && cur[0].t - prev[prev.length - 1].t < MERGE_H * 3600_000) prev.push(...cur)
      else events.push(cur)
      cur = []
    }
    cur.push(d)
  }
  if (cur.length) {
    const prev = events[events.length - 1]
    if (prev && cur[0].t - prev[prev.length - 1].t < MERGE_H * 3600_000) prev.push(...cur)
    else events.push(cur)
  }

  // 3. benennen; kleine Ereignisse in den Monats-Topf; gleiche Namen mit Uhrzeit unterscheiden
  const used = new Map<string, number>()
  for (const ev of events) {
    const first = ev[0].iso, last = ev[ev.length - 1].iso
    let name: string
    if (ev.length < MIN_N) name = monthLabel(first)
    else {
      name = rangeLabel(first, last) + cameraTag(ev.map((d) => d.p))
      const seen = used.get(name) ?? 0
      used.set(name, seen + 1)
      if (seen) name = `${rangeLabel(first, last)}, ${first.slice(11, 13)} Uhr${cameraTag(ev.map((d) => d.p))}`
    }
    for (const d of ev) d.p.album = name
  }
}
