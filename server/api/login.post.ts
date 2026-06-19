import { COOKIE_NAME, COOKIE_MAX_AGE, makeToken, checkPassword } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig(event)
  const body = await readBody<{ password?: string }>(event)

  if (!checkPassword(body?.password, cfg.galleryPassword)) {
    // kleine Verzögerung gegen Brute-Force
    await new Promise((r) => setTimeout(r, 500))
    throw createError({ statusCode: 401, statusMessage: 'Falsches Passwort' })
  }

  setCookie(event, COOKIE_NAME, makeToken(cfg.sessionSecret), {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return { ok: true }
})
