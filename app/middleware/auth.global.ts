export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return
  try {
    const fetchWithCookies = useRequestFetch()
    const me = await fetchWithCookies('/api/me')
    if (!me?.authed) return navigateTo('/login')
  } catch {
    return navigateTo('/login')
  }
})
