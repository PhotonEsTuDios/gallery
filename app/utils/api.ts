// POST hinter CloudFront OAC + AWS_IAM (Function URL) verlangt den Header
// x-amz-content-sha256 = SHA-256 des exakten Request-Bodys, sonst 403.
// Lokal ist der Header harmlos/ignoriert. GET braucht das nicht.

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function postSigned<T>(url: string, bodyObj: unknown = {}): Promise<T> {
  // exakt diesen String hashen UND senden, damit der Hash zum Body passt
  const body = JSON.stringify(bodyObj)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (globalThis.crypto?.subtle) headers['x-amz-content-sha256'] = await sha256Hex(body)
  return await $fetch<T>(url, { method: 'POST', headers, body })
}

// Seitenweise API komplett laden (gallery#2): ruft ?offset=… bis next = null.
// onPage bekommt jede Seite sofort, damit die erste Seite schon sichtbar ist.
// isStale() = true bricht ab (z. B. Herkunft gewechselt, Seite verlassen).
export async function fetchPages<T extends { next: number | null }>(
  url: string,
  query: Record<string, unknown>,
  onPage: (page: T) => void,
  isStale: () => boolean = () => false,
): Promise<void> {
  let offset: number | null = 0
  while (offset !== null && !isStale()) {
    const page: T = await $fetch<T>(url, { query: offset ? { ...query, offset } : query })
    if (isStale()) return
    onPage(page)
    offset = page.next
  }
}
