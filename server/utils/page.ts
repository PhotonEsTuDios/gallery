import type { H3Event } from 'h3'

// Große Listen seitenweise ausliefern (gallery#2): Die Lambda darf höchstens 6 MB antworten.
// 5.000 Einträge sind je nach Route 0,3–0,8 MB, also weit unter dem Limit, egal wie groß das Archiv wird.
// Antwort-Felder: total (alle Treffer), offset, next (Offset der nächsten Seite oder null).
export const PAGE_SIZE = 5000

export function pageOf<T>(event: H3Event, items: T[], size = PAGE_SIZE) {
  const q = getQuery(event)
  const offset = Math.max(0, Math.floor(Number(q.offset) || 0))
  const limit = Math.min(size, Math.max(1, Math.floor(Number(q.limit) || size)))
  const slice = items.slice(offset, offset + limit)
  const end = offset + slice.length
  return { total: items.length, offset, next: end < items.length ? end : null, slice }
}
