// Portfolio-Auswahl (vier Säulen für Instagram/Website), geteilt zwischen Lightbox und /auswahl.
export type Pillar = 'seen' | 'light' | 'eye' | 'archive'
export type Pick = { pillar: Pillar; filename: string; kind?: 'photo' | 'video'; at: string }

export const PILLAR_INFO: { key: Pillar; label: string; hint: string; consent: boolean }[] = [
  { key: 'seen', label: 'Seen', hint: 'Portraits – was ich in der Person sehe', consent: true },
  { key: 'light', label: 'Light', hint: 'Natur, Alpujarra, Licht, Texturen', consent: false },
  { key: 'eye', label: 'The Eye', hint: 'Mein Blick, Prozess, Details', consent: false },
  { key: 'archive', label: 'Archive', hint: '16 Jahre Arbeit als Serien', consent: true },
]

export function usePortfolio() {
  const picks = useState<Record<string, Pick>>('portfolio-picks', () => ({}))
  const loaded = useState('portfolio-loaded', () => false)
  const error = useState<string | null>('portfolio-error', () => null)

  async function load(force = false) {
    if (loaded.value && !force) return
    try {
      const r = await $fetch<{ picks: Record<string, Pick> }>('/api/portfolio')
      picks.value = r.picks
      loaded.value = true
      error.value = null
    } catch {
      error.value = 'Auswahl konnte nicht geladen werden'
    }
  }

  // Gleiche Säule nochmal = entfernen. Sofort anzeigen, danach mit dem Server abgleichen.
  async function toggle(photo: { sha: string; filename: string; kind?: 'photo' | 'video' }, pillar: Pillar | null) {
    const prev = picks.value[photo.sha]
    const next = pillar && prev?.pillar !== pillar ? pillar : null
    const copy = { ...picks.value }
    if (next) copy[photo.sha] = { pillar: next, filename: photo.filename, kind: photo.kind, at: new Date().toISOString() }
    else delete copy[photo.sha]
    picks.value = copy
    try {
      const r = await postSigned<{ picks: Record<string, Pick> }>('/api/portfolio', {
        sha: photo.sha, pillar: next, filename: photo.filename, kind: photo.kind,
      })
      picks.value = r.picks
      error.value = null
    } catch {
      error.value = 'Nicht gespeichert – bitte nochmal klicken'
      await load(true)
    }
  }

  return { picks, loaded, error, load, toggle }
}
