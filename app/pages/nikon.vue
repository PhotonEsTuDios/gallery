<script setup lang="ts">
// Nur Bilder aus Danielas Nikon-Kameras – zum Auswählen fürs Portfolio (Säulen in der Lightbox).
interface CameraPhoto {
  sha: string
  filename: string
  kind: 'photo' | 'video'
  model: string
  taken_at: string
  blurry: boolean
}

// server: false – mit ~15k Einträgen im SSR-Payload sprengt die Seite das Lambda-Antwortlimit (502)
const { query } = useHerkunft()
const { data, pending } = useFetch<CameraPhoto[]>('/api/nikon', { lazy: true, server: false, query })
const { picks, load } = usePortfolio()
onMounted(() => load())

const model = ref<string | null>(null) // null = alle Nikons
const year = ref<string | null>(null)
const hideBlurry = ref(true)
const hidePicked = ref(false)

const all = computed(() => data.value ?? [])
const models = computed(() => {
  const m = new Map<string, number>()
  for (const p of all.value) m.set(p.model, (m.get(p.model) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
})
const byModel = computed(() => all.value.filter((p) => !model.value || p.model === model.value))
const years = computed(() => {
  const m = new Map<string, number>()
  for (const p of byModel.value) {
    const y = p.taken_at.slice(0, 4) || '?'
    m.set(y, (m.get(y) ?? 0) + 1)
  }
  return [...m].sort((a, b) => b[0].localeCompare(a[0])).map(([y, count]) => ({ y, count }))
})
// Beim ersten Laden und bei Kamerawechsel: jüngstes Jahr mit mind. 10 Bildern vorwählen
// (hält das Raster klein). immediate, weil die Daten per SSR schon da sein können.
watch(
  years,
  (ys) => {
    if (!year.value || !ys.some((x) => x.y === year.value)) year.value = (ys.find((x) => x.count >= 10) ?? ys[0])?.y ?? null
  },
  { immediate: true },
)

const shown = computed(() =>
  byModel.value.filter(
    (p) =>
      (!year.value || p.taken_at.startsWith(year.value)) &&
      !(hideBlurry.value && p.blurry) &&
      !(hidePicked.value && picks.value[p.sha]),
  ),
)

// Nach Monat gruppiert; Index in die flache Liste für die Lightbox
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const groups = computed(() => {
  const out: { label: string; items: { p: CameraPhoto; i: number }[] }[] = []
  shown.value.forEach((p, i) => {
    const ym = p.taken_at.slice(0, 7)
    const label = ym.length === 7 ? `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}` : 'Ohne Datum'
    if (out[out.length - 1]?.label !== label) out.push({ label, items: [] })
    out[out.length - 1].items.push({ p, i })
  })
  return out
})

const pillarLabel = (sha: string) => PILLAR_INFO.find((x) => x.key === picks.value[sha]?.pillar)?.label

const lightboxList = ref<CameraPhoto[]>([])
const openIndex = ref<number | null>(null)
function open(i: number) {
  lightboxList.value = [...shown.value]
  openIndex.value = i
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-sm uppercase tracking-[0.2em] text-neutral-500">Nikon</h1>
      <span v-if="data" class="text-xs text-neutral-500">{{ all.length.toLocaleString('de-DE') }} Aufnahmen</span>
    </div>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="!all.length" class="text-sm text-neutral-500">Noch keine Nikon-Aufnahmen erkannt.</p>

    <template v-else>
      <!-- Kamera -->
      <div class="mb-3 flex flex-wrap gap-2">
        <button
          class="rounded-full border px-3 py-1 text-xs transition"
          :class="!model ? 'border-neutral-400 text-neutral-100' : 'border-line text-neutral-400 hover:text-neutral-200'"
          @click="model = null"
        >
          Alle Nikons <span class="text-neutral-500">{{ all.length }}</span>
        </button>
        <button
          v-for="m in models"
          :key="m.name"
          class="rounded-full border px-3 py-1 text-xs transition"
          :class="model === m.name ? 'border-neutral-400 text-neutral-100' : 'border-line text-neutral-400 hover:text-neutral-200'"
          @click="model = m.name"
        >
          {{ m.name }} <span class="text-neutral-500">{{ m.count }}</span>
        </button>
      </div>

      <!-- Jahr -->
      <div class="mb-3 flex flex-wrap gap-1">
        <button
          v-for="y in years"
          :key="y.y"
          class="rounded-full px-3 py-1 text-xs transition"
          :class="year === y.y ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
          @click="year = y.y"
        >
          {{ y.y }} <span class="opacity-60">{{ y.count }}</span>
        </button>
      </div>

      <div class="mb-6 flex flex-wrap gap-4 text-xs text-neutral-400">
        <label class="flex cursor-pointer items-center gap-2"><input v-model="hideBlurry" type="checkbox" /> Unscharfe ausblenden</label>
        <label class="flex cursor-pointer items-center gap-2"><input v-model="hidePicked" type="checkbox" /> Schon gewählte ausblenden</label>
        <span class="text-neutral-500">{{ shown.length }} sichtbar · Bild öffnen, dann 1–4 für die Säule</span>
      </div>

      <section v-for="g in groups" :key="g.label" class="mb-6">
        <h2 class="mb-2 text-xs uppercase tracking-[0.15em] text-neutral-500">{{ g.label }}</h2>
        <div class="grid gap-1" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))">
          <button
            v-for="{ p, i } in g.items"
            :key="p.sha"
            class="group relative aspect-square overflow-hidden rounded-md border border-line bg-ink-soft"
            @click="open(i)"
          >
            <img
              :src="p.kind === 'video' ? `/poster/${p.sha}` : `/img/${p.sha}?w=400`"
              :alt="p.filename"
              loading="lazy"
              class="h-full w-full object-cover transition duration-300 group-hover:opacity-90"
            />
            <span
              v-if="pillarLabel(p.sha)"
              class="absolute left-1 top-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-black"
            >
              {{ pillarLabel(p.sha) }}
            </span>
          </button>
        </div>
      </section>
    </template>

    <PhotoLightbox :photos="lightboxList" v-model:index="openIndex" />
  </div>
</template>
