// Timeline-Abschnitte (gallery#11): dünne Monate zu Quartalen oder Jahren zusammenfassen.
// Ziel: keine Mini-Abschnitte (große sind ok). Regel:
//   Jahr < YEAR_MIN Fotos                                   -> ein Abschnitt "2026"
//   sonst je Quartal: jeder belegte Monat >= MONTH_MIN      -> Monate "2026-08"
//                     sonst                                  -> Quartal "2026-Q3"
// "0000-00" = ohne Datum bleibt eigener Abschnitt.
export const YEAR_MIN = 30
export const MONTH_MIN = 15

export type Span = 'month' | 'quarter' | 'year'

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const MON_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

const quarterOf = (ym: string) => `${ym.slice(0, 4)}-Q${Math.floor((Number(ym.slice(5, 7)) - 1) / 3) + 1}`

/** Plan aus den Monatszahlen ({"2026-08": 18, …}): Jahr -> 'year' bzw. Quartal -> 'month'|'quarter'. */
export function planSpans(monthCounts: Map<string, number>): Map<string, Span> {
  const years = new Map<string, number>()
  const thinQ = new Map<string, boolean>()
  for (const [ym, n] of monthCounts) {
    if (ym === '0000-00' || !n) continue
    years.set(ym.slice(0, 4), (years.get(ym.slice(0, 4)) ?? 0) + n)
    const q = quarterOf(ym)
    thinQ.set(q, (thinQ.get(q) ?? false) || n < MONTH_MIN)
  }
  const plan = new Map<string, Span>()
  for (const [y, total] of years) if (total < YEAR_MIN) plan.set(y, 'year')
  for (const [q, thin] of thinQ) if (!plan.has(q.slice(0, 4))) plan.set(q, thin ? 'quarter' : 'month')
  return plan
}

/** Abschnitts-Schlüssel eines Monats nach Plan. */
export function bucketOf(ym: string, plan: Map<string, Span>): string {
  if (ym === '0000-00') return ym
  const y = ym.slice(0, 4)
  if (plan.get(y) === 'year') return y
  const q = quarterOf(ym)
  return plan.get(q) === 'quarter' ? q : ym
}

/** Sortierschlüssel (neueste zuerst absteigend sortieren): Ende des Abschnitts, "2026-Q3" -> "2026-09". */
export function sortKey(key: string): string {
  if (key.length === 4) return `${key}-12`
  if (key.includes('Q')) return `${key.slice(0, 4)}-${String(Number(key.slice(6)) * 3).padStart(2, '0')}`
  return key
}

export const KEY_RE = /^(\d{4}|\d{4}-(0\d|1[0-2])|\d{4}-Q[1-4]|0000-00)$/

/** Gehört der Monat ym zum Abschnitt key? (unabhängig vom Plan, für /api/timeline/<key>) */
export function inBucket(ym: string, key: string): boolean {
  if (key === '0000-00' || /^\d{4}-\d{2}$/.test(key)) return ym === key
  if (ym === '0000-00' || !ym.startsWith(key.slice(0, 4))) return false
  if (key.length === 4) return true
  const q = Number(key.slice(6))
  const m = Number(ym.slice(5, 7))
  return m >= q * 3 - 2 && m <= q * 3
}

export function spanOf(key: string): Span {
  return key.length === 4 ? 'year' : key.includes('Q') ? 'quarter' : 'month'
}

export function bucketLabel(key: string): string {
  if (key === '0000-00') return 'Ohne Datum'
  const y = key.slice(0, 4)
  if (key.length === 4) return y
  if (key.includes('Q')) {
    const q = Number(key.slice(6))
    return `${MON_SHORT[q * 3 - 3]} – ${MON_SHORT[q * 3 - 1]} ${y}`
  }
  return `${MONTHS_DE[Number(key.slice(5, 7)) - 1]} ${y}`
}
