// Gemeinsamer Filter für alle Ansichten (gallery#8), steht in der URL -> speicherbar und teilbar:
//   /timeline?p=Santi,Nepo&pm=oder&farbe=Blau&jahr=2024&herkunft=dropbox
// Server-Gegenstück: server/utils/filter.ts (gleiche Parameter).
export const FILTER_KEYS = ['p', 'pm', 'farbe', 'jahr', 'herkunft'] as const
type Key = (typeof FILTER_KEYS)[number]

export const HERKUNFT_OPTIONEN = [
  { id: 'dropbox', label: 'Dropbox' },
  { id: 'timemachine', label: 'Time Machine' },
  { id: 'icloud', label: 'iCloud' },
  { id: 'lokal', label: 'Lokal' },
] as const

export const FARBEN: { id: string; hex: string }[] = [
  { id: 'Rot', hex: '#d33' }, { id: 'Orange', hex: '#e8862a' }, { id: 'Braun', hex: '#8a5a2b' },
  { id: 'Gelb', hex: '#e6c62e' }, { id: 'Grün', hex: '#3fa34d' }, { id: 'Türkis', hex: '#2bb3b1' },
  { id: 'Blau', hex: '#2f6fd6' }, { id: 'Lila', hex: '#8c4fd1' }, { id: 'Pink', hex: '#e05aa0' },
  { id: 'Weiß', hex: '#f2f2f2' }, { id: 'Grau', hex: '#888' }, { id: 'Schwarz', hex: '#111' },
]

export function useFilter() {
  const route = useRoute()

  // nur Filter-Parameter, als stabiles Objekt für useFetch({ query }) / fetchPages
  const query = computed<Record<string, string>>(() => {
    const q: Record<string, string> = {}
    for (const k of FILTER_KEYS) {
      const v = route.query[k]
      const s = Array.isArray(v) ? v.join(',') : v
      if (typeof s === 'string' && s) q[k] = s
    }
    return q
  })
  const listOf = (k: Key) => computed(() => (query.value[k] || '').split(',').filter(Boolean))
  const persons = listOf('p')
  const colors = listOf('farbe')
  const years = listOf('jahr')
  const origins = listOf('herkunft')
  const personMode = computed<'zusammen' | 'oder'>(() => (query.value.pm === 'oder' ? 'oder' : 'zusammen'))
  const active = computed(() => persons.value.length + colors.value.length + years.value.length + origins.value.length > 0)

  function setParam(k: Key, value: string | undefined) {
    return navigateTo({ path: route.path, hash: route.hash, query: { ...route.query, [k]: value || undefined } }, { replace: true })
  }
  function setList(k: Key, values: string[]) {
    return setParam(k, [...new Set(values)].join(','))
  }
  function toggle(k: Key, value: string) {
    const cur = listOf(k).value
    return setList(k, cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value])
  }
  function setPersonMode(m: 'zusammen' | 'oder') {
    return setParam('pm', m === 'oder' ? 'oder' : undefined)
  }
  function clear() {
    const q = { ...route.query }
    for (const k of FILTER_KEYS) delete q[k]
    return navigateTo({ path: route.path, query: q }, { replace: true })
  }
  /** Link auf eine andere Ansicht mit demselben Filter. */
  function to(path: string) {
    return { path, query: query.value }
  }

  return { query, persons, colors, years, origins, personMode, active, toggle, setList, setPersonMode, clear, to }
}
