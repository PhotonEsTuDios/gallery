// Fortschritt der Erkennungs-Läufe (gallery#21). Die Läufe in staubsauger schreiben je einen
// Fortschritts-Eintrag in die Foto-Tabelle (faces_cloud/store.py: start_progress / add_progress):
//   sha256 = "__animals__" bzw. "__faces__", Felder done, total, faces (Gefundene), err,
//   packages_done, packages, planned_at, updated_at. Jeder neue Plan setzt den Eintrag zurück.

export const RUNS = [
  { key: 'tiere', label: 'Tier-Erkennung', found_label: 'Tiere gefunden', item: '__animals__' },
  { key: 'gesichter', label: 'Gesichtserkennung', found_label: 'Gesichter gefunden', item: '__faces__' },
] as const

export interface RunProgress {
  state: 'noch nicht gelaufen' | 'läuft' | 'fertig'
  done: number
  total: number
  found: number
  err: number
  packages_done: number
  packages: number
  percent: number
  planned_at: string | null
  updated_at: string | null
}

export function runProgress(item: Record<string, unknown> | undefined): RunProgress {
  const n = (k: string) => { const v = Number(item?.[k] ?? 0); return Number.isFinite(v) ? v : 0 }
  const s = (k: string) => (typeof item?.[k] === 'string' ? (item[k] as string) : null)
  const total = n('total')
  const done = n('done') + n('err') // Fehler zählen als bearbeitet, wie in staubsauger/status.py
  const finished = total > 0 ? done >= total : n('packages_done') >= n('packages')
  return {
    state: !item ? 'noch nicht gelaufen' : finished ? 'fertig' : 'läuft',
    done: Math.min(done, total || done),
    total,
    found: n('faces'),
    err: n('err'),
    packages_done: n('packages_done'),
    packages: n('packages'),
    percent: total > 0 ? Math.min(100, Math.floor((1000 * done) / total) / 10) : item ? 100 : 0,
    planned_at: s('planned_at'),
    updated_at: s('updated_at'),
  }
}
