<script setup lang="ts">
interface TimelineMonth {
  ym: string
  label: string
  count: number
  cover: string
}
interface Photo {
  sha: string
  filename: string
  bytes: number
  uploaded_at: string
  kind: 'photo' | 'video'
}

// 1) Leichter Index zuerst — nur Monate + Anzahl (winzig), noch keine Bilder.
const { query } = useHerkunft()
const { data: months, pending } = useFetch<TimelineMonth[]>('/api/timeline', { lazy: true, query })

// 2) Pro Monat nachgeladene Bilder + welche Monate gerade gerendert werden.
const loaded = reactive<Record<string, Photo[]>>({})
const started = reactive<Record<string, boolean>>({}) // verhindert Doppel-Fetch
const renderedMap = reactive<Record<string, boolean>>({}) // <img> im DOM ja/nein

// Herkunft gewechselt -> nachgeladene Monate verwerfen
watch(query, () => {
  for (const k of Object.keys(loaded)) delete loaded[k]
  for (const k of Object.keys(started)) delete started[k]
})

async function loadMonth(ym: string) {
  if (started[ym]) return
  started[ym] = true
  try {
    // seitenweise (gallery#2); erste Seite sofort zeigen, Rest anhängen
    const q = query.value
    await fetchPages<{ items: Photo[]; next: number | null }>(`/api/timeline/${ym}`, q, ({ items }) => {
      loaded[ym] = (loaded[ym] ?? []).concat(items)
    }, () => q !== query.value)
  } catch {
    started[ym] = false // Fehler -> später erneut versuchen
  }
}

// --- Dichte (S/M/L): steuert die Spaltenzahl = Bildgröße ---------------------
type Density = 'S' | 'M' | 'L'
const CELL_TARGET: Record<Density, number> = { S: 78, M: 120, L: 200 } // Ziel-Kachelbreite px
const density = ref<Density>('L')
onMounted(() => {
  const saved = localStorage.getItem('tl-density') as Density | null
  if (saved === 'S' || saved === 'M' || saved === 'L') density.value = saved
})
watch(density, (d) => localStorage.setItem('tl-density', d))

// --- Foto/Video-Filter ---
type Kind = 'all' | 'photo' | 'video'
const mediaFilter = ref<Kind>('all')
function keep(p: Photo) {
  return mediaFilter.value === 'all' || p.kind === mediaFilter.value
}
function shownIn(ym: string): Photo[] {
  return (loaded[ym] ?? []).filter(keep)
}

// 3) Höhe je Monatsblock VORAB aus der Anzahl reservieren, damit der
//    Scrollbalken sofort korrekt ist und nichts springt.
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(1024)
const GAP = 4
const HEADER_H = 52

function cols(): number {
  const t = CELL_TARGET[density.value]
  return Math.max(2, Math.floor((containerWidth.value + GAP) / (t + GAP)))
}
function sectionHeight(m: TimelineMonth): number {
  const c = cols()
  const cell = (containerWidth.value - (c - 1) * GAP) / c
  const rows = Math.ceil(m.count / c)
  return Math.round(HEADER_H + rows * (cell + GAP))
}

// 4) IntersectionObserver: Monat lädt + rendert, sobald er in Sichtnähe kommt;
//    weit entfernte Monate werden wieder entladen (Platz bleibt reserviert).
let observer: IntersectionObserver | null = null
const sectionEls = new Map<string, Element>()
function setSectionRef(ym: string, el: Element | null) {
  if (el) {
    sectionEls.set(ym, el)
    observer?.observe(el)
  } else {
    const prev = sectionEls.get(ym)
    if (prev) observer?.unobserve(prev)
    sectionEls.delete(ym)
  }
}
function onIntersect(entries: IntersectionObserverEntry[]) {
  for (const e of entries) {
    const ym = (e.target as HTMLElement).dataset.ym
    if (!ym || !e.isIntersecting) continue
    // Einmal in Sichtnaehe gerendert -> bleibt gerendert (kein Entladen =
    // kein Rein/Raus-Flackern beim Scrollen). Danach nicht mehr beobachten.
    renderedMap[ym] = true
    loadMonth(ym)
    const el = sectionEls.get(ym)
    if (el) observer?.unobserve(el)
  }
}

let ro: ResizeObserver | null = null
onMounted(() => {
  observer = new IntersectionObserver(onIntersect, { rootMargin: '800px 0px' })
  sectionEls.forEach((el) => observer!.observe(el))
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth
    ro = new ResizeObserver((entries) => {
      containerWidth.value = entries[0].contentRect.width
    })
    ro.observe(containerRef.value)
  }
})
onUnmounted(() => {
  observer?.disconnect()
  ro?.disconnect()
})

// 5) Jahres-/Monats-Sprungleiste — aus dem Monats-Index gruppiert.
const MON_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
function monShort(ym: string) {
  return MON_SHORT[Number(ym.slice(5, 7)) - 1] ?? '·'
}
const years = computed(() => {
  const map = new Map<string, TimelineMonth[]>()
  for (const m of months.value ?? []) {
    const y = m.ym.slice(0, 4)
    const arr = map.get(y)
    if (arr) arr.push(m)
    else map.set(y, [m])
  }
  return [...map.entries()].map(([year, ms]) => ({
    year,
    label: year === '0000' ? 'o.D.' : year,
    months: ms, // schon absteigend (Dez … Jan)
  }))
})
function scrollToYm(ym: string) {
  const el = sectionEls.get(ym) as HTMLElement | undefined
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 58 // unter den Header
  window.scrollTo({ top, behavior: 'smooth' })
}

// 6) Lightbox über alle bereits geladenen Bilder (in Monatsreihenfolge).
const openIndex = ref<number | null>(null)
const allLoaded = computed<Photo[]>(() =>
  (months.value ?? []).flatMap((m) => loaded[m.ym] ?? []).filter(keep),
)
function open(sha: string) {
  const i = allLoaded.value.findIndex((p) => p.sha === sha)
  if (i >= 0) openIndex.value = i
}
</script>

<template>
  <div ref="containerRef" class="mx-auto max-w-7xl px-5 py-8">
    <h1 class="mb-6 text-sm uppercase tracking-[0.2em] text-neutral-500">Timeline</h1>

    <!-- Dichte-Umschalter: fix schwebend, immer erreichbar -->
    <div
      v-if="months?.length"
      class="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-ink/85 p-1 shadow-lg backdrop-blur"
    >
      <!-- Foto/Video-Filter -->
      <div class="flex items-center gap-1">
        <button
          v-for="f in (['all', 'photo', 'video'] as const)"
          :key="f"
          class="rounded-full px-2.5 py-1 text-xs transition"
          :class="mediaFilter === f ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
          @click="mediaFilter = f"
        >
          {{ f === 'all' ? 'Alle' : f === 'photo' ? 'Fotos' : 'Videos' }}
        </button>
      </div>
      <span class="h-4 w-px bg-line" />
      <!-- Dichte -->
      <div class="flex items-center gap-1">
        <button
          v-for="d in (['S', 'M', 'L'] as const)"
          :key="d"
          class="h-7 w-8 rounded-full text-xs transition"
          :class="density === d ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
          :title="d === 'S' ? 'klein – ganzer Monat auf einen Blick' : d === 'M' ? 'mittel' : 'groß'"
          @click="density = d"
        >
          {{ d }}
        </button>
      </div>
    </div>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="!months?.length" class="text-sm text-neutral-500">Noch keine Fotos.</p>

    <div v-else>
      <section
        v-for="m in months"
        :key="m.ym"
        :ref="(el) => setSectionRef(m.ym, el as Element | null)"
        :data-ym="m.ym"
        :style="(renderedMap[m.ym] || mediaFilter !== 'all') ? undefined : { minHeight: sectionHeight(m) + 'px' }"
      >
        <h2
          class="sticky top-[52px] z-10 -mx-5 mb-2 bg-ink/85 px-5 py-2 text-sm font-medium backdrop-blur"
        >
          {{ m.label }}
          <span class="text-neutral-500">· {{ m.count.toLocaleString('de-DE') }}</span>
        </h2>

        <div
          v-if="renderedMap[m.ym] && loaded[m.ym]?.length"
          class="mb-8"
          :style="{ display: 'grid', gridTemplateColumns: `repeat(${cols()}, 1fr)`, gap: GAP + 'px' }"
        >
          <button
            v-for="p in shownIn(m.ym)"
            :key="p.sha"
            class="group relative aspect-square overflow-hidden rounded-md border border-line bg-ink-soft"
            @click="open(p.sha)"
          >
            <VideoTile v-if="p.kind === 'video'" :sha="p.sha" :filename="p.filename" />
            <img
              v-else
              :src="`/img/${p.sha}?w=400`"
              :alt="p.filename"
              loading="lazy"
              class="h-full w-full object-cover transition duration-300 group-hover:opacity-90"
            />
          </button>
        </div>
      </section>
    </div>

    <!-- Jahres-/Monats-Sprungleiste (rechts, ab md sichtbar) -->
    <nav
      v-if="years.length"
      class="fixed right-1 top-1/2 z-30 hidden max-h-[80vh] -translate-y-1/2 flex-col items-end gap-0.5 overflow-y-auto py-2 md:flex"
    >
      <div v-for="y in years" :key="y.year" class="group/year relative">
        <button
          class="block rounded px-2 py-0.5 text-xs tabular-nums text-neutral-500 transition hover:text-neutral-100"
          @click="scrollToYm(y.months[0].ym)"
        >
          {{ y.label }}
        </button>
        <!-- Monats-Flyout beim Hovern -->
        <div
          class="absolute right-full top-1/2 mr-1 hidden -translate-y-1/2 flex-wrap justify-end gap-1 rounded-lg border border-line bg-ink/95 p-2 backdrop-blur group-hover/year:flex"
          style="width: 180px"
        >
          <button
            v-for="m in y.months"
            :key="m.ym"
            class="rounded px-1.5 py-0.5 text-[11px] text-neutral-400 transition hover:bg-neutral-700 hover:text-neutral-100"
            @click="scrollToYm(m.ym)"
          >
            {{ monShort(m.ym) }}
          </button>
        </div>
      </div>
    </nav>

    <PhotoLightbox :photos="allLoaded" v-model:index="openIndex" />
  </div>
</template>
