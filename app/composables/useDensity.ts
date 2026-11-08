// Vorschaugröße XS…XL für alle Foto-Ansichten (gallery#13/#14). Eine Größe gilt überall
// (Zustand geteilt, im Browser gemerkt). Umschalten: <DensityToggle> (Knöpfe + Tasten +/−).
export const DENSITIES = ['XS', 'S', 'M', 'L', 'XL'] as const
export type Density = (typeof DENSITIES)[number]
export const CELL_TARGET: Record<Density, number> = { XS: 48, S: 78, M: 120, L: 200, XL: 400 } // Ziel-Kachelbreite px
export const DENSITY_TITLE: Record<Density, string> = {
  XS: 'winzig – ganzes Jahr auf einen Blick', S: 'klein – ganzer Monat auf einen Blick', M: 'mittel', L: 'groß', XL: 'sehr groß',
}
export const GRID_GAP = 4
const STORE_KEY = 'density'
const OLD_KEY = 'tl-density' // bis gallery#13 nur Timeline

/** Thumbnail-Breite zur Kachel (Retina ≈ 2×): bis 78 px reicht w=200, bis 200 px w=400, darüber w=800. */
export function thumbWidthFor(cell: number): 200 | 400 | 800 {
  return cell <= 78 ? 200 : cell <= 200 ? 400 : 800
}

function readSaved(): Density | null {
  try {
    const v = localStorage.getItem(STORE_KEY) ?? localStorage.getItem(OLD_KEY)
    return v && (DENSITIES as readonly string[]).includes(v) ? (v as Density) : null
  } catch {
    return null
  }
}

export function useDensity() {
  const density = useState<Density>('density', () => 'L')
  const restored = useState('density-restored', () => false)
  // erst nach dem Aufbau lesen: Server rendert "L", sonst passt das HTML beim Hydrieren nicht
  if (import.meta.client && !restored.value && getCurrentInstance()) {
    restored.value = true
    onMounted(() => {
      const saved = readSaved()
      if (saved) density.value = saved
    })
  }
  const cell = computed(() => CELL_TARGET[density.value])
  const thumbW = computed(() => thumbWidthFor(cell.value))
  /** Raster für einfache Ansichten (Album, Labels, …): Spalten füllen sich nach Kachelbreite. */
  const gridStyle = computed(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${cell.value}px, 1fr))`,
    gap: `${GRID_GAP}px`,
  }))
  function set(d: Density) {
    density.value = d
    try { localStorage.setItem(STORE_KEY, d) } catch { /* privates Fenster: nur diese Sitzung */ }
  }
  function step(dir: number) {
    const i = DENSITIES.indexOf(density.value) + dir
    if (i >= 0 && i < DENSITIES.length) set(DENSITIES[i])
  }
  return { density, cell, thumbW, gridStyle, set, step }
}

/** Lightbox offen? (Tasten +/− sollen dann nichts tun) — setzt PhotoLightbox. */
export const useLightboxOpen = () => useState<boolean>('lightbox-open', () => false)
