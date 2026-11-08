// Timeline-Abschnitte (gallery#11): dünne Monate zu Quartalen oder Jahren zusammenfassen.
// Regel je Jahr (eine Stufe pro Jahr, damit die Timeline ruhig bleibt):
//   < YEAR_MIN Fotos im Jahr                         -> ein Abschnitt "2026"
//   sonst Ø < MONTH_MIN Fotos je belegtem Monat      -> Quartale "2026-Q3"
//   sonst                                             -> Monate "2026-08"
// "0000-00" = ohne Datum bleibt eigener Abschnitt.
export const YEAR_MIN = 30
export const MONTH_MIN = 15

export type Span = 'month' | 'quarter' | 'year'

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const MON_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

/** Stufe je Jahr aus den Monatszahlen ({"2026-08": 18, …}). */
export function planSpans(monthCounts: Map<string, number>): Map<string, Span> {
  const years = new Map<string, { total: number; months: number }>()
  for (const [ym, n] of monthCounts) {
    if (ym === '0000-00' || !n) continue
    const y = ym.slice(0, 4)
    const s = years.get(y) ?? { total: 0, months: 0 }
    s.total += n
    s.months += 1
    years.set(y, s)
  }
  const plan = new Map<string, Span>()
  for (const [y, s] of years) {
    plan.set(y, s.total < YEAR_MIN ? 'year' : s.total / s.months < MONTH_MIN ? 'quarter' : 'month')
  }
  return plan
}

/** Abschnitts-Schlüssel eines Monats nach Plan. */
export function bucketOf(ym: string, plan: Map<string, Span>): string {
  if (ym === '0000-00') return ym
  const y = ym.slice(0, 4)
  const span = plan.get(y) ?? 'month'
  if (span === 'year') return y
  if (span === 'quarter') return `${y}-Q${Math.floor((Number(ym.slice(5, 7)) - 1) / 3) + 1}`
  return ym
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
