import { COOKIE_NAME, verifyToken } from '../utils/auth'

export default defineEventHandler((event) => {
  const cfg = useRuntimeConfig(event)
  return { authed: verifyToken(getCookie(event, COOKIE_NAME), cfg.sessionSecret) }
})
