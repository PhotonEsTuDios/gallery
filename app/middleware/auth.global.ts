export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  // Auth-Status nur EINMAL prüfen (beim ersten Laden, serverseitig) und merken.
  // Bei Klick-Navigation danach KEIN /api/me mehr -> blockiert die Navigation nie
  // (sonst Deadlock gegen die vielen parallelen Thumbnail-Requests).
  const authed = useState('authed', () => false)
  if (authed.value) return

  try {
    const me = await useRequestFetch()('/api/me')
    if (!me?.authed) return navigateTo('/login')
    authed.value = true
  } catch {
    return navigateTo('/login')
  }
})
