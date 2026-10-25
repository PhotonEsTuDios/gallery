import { COOKIE_NAME, verifyToken } from '../utils/auth'

// Schützt alle Daten-/Bild-Endpunkte. Login/Logout/Me bleiben offen.
// /api/share/* prüft das eigene Share-Cookie selbst (siehe server/utils/share.ts)
const OPEN = ['/api/login', '/api/logout', '/api/me', '/api/share/']

export default defineEventHandler((event) => {
  const path = event.path || ''
  const guarded =
    path.startsWith('/img/') ||
    path.startsWith('/poster/') ||
    (path.startsWith('/api/') && !OPEN.some((o) => path.startsWith(o)))
  if (!guarded) return

  const cfg = useRuntimeConfig(event)
  const token = getCookie(event, COOKIE_NAME)
  if (!verifyToken(token, cfg.sessionSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
