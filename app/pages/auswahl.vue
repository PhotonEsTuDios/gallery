<script setup lang="ts">
import type { Pillar } from '~/composables/usePortfolio'

// Portfolio-Auswahl je Säule. Gewählt wird in jeder Lightbox (Alben, Timeline, Labels).
const { picks, loaded, error, load } = usePortfolio()
onMounted(() => load(true))

const tab = ref<Pillar>('seen')
const counts = computed(() => {
  const c: Record<string, number> = {}
  for (const p of Object.values(picks.value)) c[p.pillar] = (c[p.pillar] ?? 0) + 1
  return c
})
const total = computed(() => Object.keys(picks.value).length)
const info = computed(() => PILLAR_INFO.find((p) => p.key === tab.value)!)

// Neueste Auswahl zuerst
const shown = computed(() =>
  Object.entries(picks.value)
    .filter(([, p]) => p.pillar === tab.value)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([sha, p]) => ({ sha, filename: p.filename, kind: p.kind })),
)

// Lightbox auf einer Kopie, damit Umsortieren die offene Liste nicht verschiebt
const lightboxList = ref<{ sha: string; filename: string; kind?: 'photo' | 'video' }[]>([])
const openIndex = ref<number | null>(null)
function open(i: number) {
  lightboxList.value = [...shown.value]
  openIndex.value = i
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-sm uppercase tracking-[0.2em] text-neutral-500">Auswahl</h1>
      <span class="text-xs text-neutral-500">{{ total }} {{ total === 1 ? 'Bild' : 'Bilder' }} gewählt</span>
    </div>

    <div class="mb-3 flex w-fit flex-wrap gap-1 rounded-full border border-line p-1">
      <button
        v-for="p in PILLAR_INFO"
        :key="p.key"
        class="rounded-full px-4 py-1.5 text-xs transition"
        :class="tab === p.key ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
        @click="tab = p.key"
      >
        {{ p.label }} <span class="ml-1 opacity-60">{{ counts[p.key] ?? 0 }}</span>
      </button>
    </div>
    <p class="mb-5 text-xs text-neutral-500">
      {{ info.hint }}<span v-if="info.consent" class="text-amber-300/80"> · Freigabe der Personen vor dem Posten</span>
    </p>

    <p v-if="error" class="text-sm text-red-400">{{ error }}</p>
    <p v-else-if="!loaded" class="text-sm text-neutral-500">Lade…</p>
    <div v-else-if="!shown.length" class="max-w-md text-sm leading-relaxed text-neutral-500">
      Noch nichts in „{{ info.label }}". Öffne ein Bild in Alben, Timeline oder Labels
      (Tipp: Labels → Beste) und wähle unten eine Säule – oder drück die Tasten 1–4.
      Nochmal dieselbe Säule oder 0 nimmt es wieder raus.
    </div>

    <div v-else class="grid gap-1" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))">
      <button
        v-for="(p, i) in shown"
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
      </button>
    </div>

    <PhotoLightbox :photos="lightboxList" v-model:index="openIndex" />
  </div>
</template>
