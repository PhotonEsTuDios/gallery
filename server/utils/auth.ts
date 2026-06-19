import { createHmac, timingSafeEqual } from 'node:crypto'

export const COOKIE_NAME = 'photon_gallery'
const MAX_AGE_DAYS = 30

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

/** Erzeugt ein signiertes Session-Token (payload = Version + Zeitstempel). */
export function makeToken(secret: string): string {
  const payload = `v1.${Date.now()}`
  return `${payload}.${sign(payload, secret)}`
}

/** Prüft Signatur + Ablauf des Tokens (timing-safe). */
export function verifyToken(token: string | undefined, secret: string): boolean {
  if (!token) return false
  const i = token.lastIndexOf('.')
  if (i < 0) return false
  const payload = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expected = sign(payload, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  const ts = Number(payload.split('.')[1])
  if (!ts) return false
  return Date.now() - ts <= MAX_AGE_DAYS * 24 * 3600 * 1000
}

/** Vergleicht das eingegebene Passwort timing-safe gegen das erwartete. */
export function checkPassword(input: unknown, expected: string): boolean {
  if (!expected || typeof input !== 'string') return false
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export const COOKIE_MAX_AGE = MAX_AGE_DAYS * 24 * 3600
