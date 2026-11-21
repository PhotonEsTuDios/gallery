// Bewertung 1–5 Sterne je Foto (gallery#19). Gilt global, liegt direkt am Foto-Eintrag:
// rating (1–5) + rated_at. Die Gallery schreibt am Foto NUR diese zwei Felder; die Rechte
// (infra/iam.sh, Sid „Bewerten“) lassen auch nichts anderes zu. Der Index bleibt unberührt:
// die Lightbox liest die Sterne beim Öffnen einzeln.

export const RATING_FIELDS = ['rating', 'rated_at'] as const

/** Nur echte Foto-Einträge: 64 Hex-Zeichen. Steuer-Einträge (`__…__`) fallen damit raus. */
export const isPhotoSha = (sha: unknown): sha is string => typeof sha === 'string' && /^[0-9a-f]{64}$/.test(sha)

/** 1…5 als ganze Zahl; null = Bewertung zurücknehmen; alles andere ist ungültig (undefined). */
export function parseRating(v: unknown): number | null | undefined {
  if (v === null) return null
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5 ? v : undefined
}

/** Parameter für UpdateItem. attribute_exists verhindert, dass ein unbekannter sha einen Eintrag anlegt. */
export function ratingUpdate(table: string, sha: string, rating: number | null, now: string) {
  const base = { TableName: table, Key: { sha256: sha }, ConditionExpression: 'attribute_exists(sha256)' }
  return rating === null
    ? { ...base, UpdateExpression: 'REMOVE rating, rated_at' }
    : { ...base, UpdateExpression: 'SET rating = :r, rated_at = :t', ExpressionAttributeValues: { ':r': rating, ':t': now } }
}

/** Antwort der API aus dem Foto-Eintrag (fremde/kaputte Werte = keine Bewertung). */
export function ratingOf(item: Record<string, unknown> | undefined): { rating: number | null; rated_at: string | null } {
  const r = parseRating(typeof item?.rating === 'number' ? item.rating : Number(item?.rating ?? NaN))
  return r ? { rating: r, rated_at: typeof item?.rated_at === 'string' ? item.rated_at : null } : { rating: null, rated_at: null }
}
