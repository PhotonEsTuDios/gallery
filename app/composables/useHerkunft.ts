// Herkunfts-Filter (Dropbox / Time Machine / iCloud / Lokal), seitenübergreifend.
// Gespeichert im Cookie, damit er Reloads und SSR übersteht.
// Leer = alle Quellen.
export const HERKUNFT_OPTIONEN = [
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'timemachine', label: 'Time Machine' },
  { id: 'icloud', label: 'iCloud' },
  { id: 'lokal', label: 'Lokal' },
] as const

export function useHerkunft() {
  const cookie = useCookie<string>('herkunft', { default: () => '', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  const selected = computed<string[]>(() => (cookie.value || '').split(',').filter(Boolean))
  // für useFetch({ query }) — reaktiv, löst bei Änderung einen Refetch aus
  const query = computed(() => (cookie.value ? { herkunft: cookie.value } : {}))

  function toggle(id: string) {
    const s = new Set(selected.value)
    s.has(id) ? s.delete(id) : s.add(id)
    cookie.value = [...s].join(',')
  }
  function clear() {
    cookie.value = ''
  }
  return { selected, query, toggle, clear, cookie }
}
