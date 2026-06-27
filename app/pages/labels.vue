<script setup lang="ts">
interface LabeledPhoto {
  sha: string
  filename: string
  quality: number
  blurry: boolean
  colors: string[]
  family: string
}
interface LabelData {
  count: number
  items: LabeledPhoto[]
}

const { data, pending } = useFetch<LabelData>('/api/labels', { lazy: true })

type Tab = 'best' | 'blurry' | 'color'
const tab = ref<Tab>('best')

// Tab-Listen
const best = computed(() => (data.value?.items ?? []).filter((p) => !p.blurry)) // schon quality-sortiert
const blurry = computed(() =>
  (data.value?.items ?? []).filter((p) => p.blurry).sort((a, b) => a.quality - b.quality),
)

// Farbfamilien (Reihenfolge + Swatch zum Anzeigen)
const FAMILY_ORDER = ['Rot', 'Orange', 'Braun', 'Gelb', 'Grün', 'Türkis', 'Blau', 'Lila', 'Pink', 'Schwarz', 'Grau', 'Weiß', 'Neutral']
const FAMILY_HEX: Record<string, string> = {
  Rot: '#c0392b', Orange: '#e67e22', Braun: '#7b4a2e', Gelb: '#f1c40f', Grün: '#27ae60',
  Türkis: '#1abc9c', Blau: '#2980b9', Lila: '#8e44ad', Pink: '#e84393',
  Schwarz: '#111111', Grau: '#7f8c8d', Weiß: '#ecf0f1', Neutral: '#95a5a6',
}
const families = computed(() => {
  const m = new Map<string, number>()
  for (const p of data.value?.items ?? []) m.set(p.family, (m.get(p.family) ?? 0) + 1)
  return FAMILY_ORDER.filter((f) => m.has(f)).map((f) => ({ family: f, count: m.get(f)!, hex: FAMILY_HEX[f] }))
})
const activeFamily = ref<string | null>(null)
watch(families, (f) => {
  if (!activeFamily.value && f.length) activeFamily.value = f[0].family
})
const colorPhotos = computed(() =>
  (data.value?.items ?? []).filter((p) => p.family === activeFamily.value),
)

// aktuelle Liste je Tab (für Grid + Lightbox)
const shown = computed<LabeledPhoto[]>(() =>
  tab.value === 'best' ? best.value : tab.value === 'blurry' ? blurry.value : colorPhotos.value,
)

// Lightbox
const openIndex = ref<number | null>(null)
function open(i: number) {
  openIndex.value = i
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'best', label: '📸 Beste' },
  { key: 'blurry', label: '🗑️ Unscharf' },
  { key: 'color', label: '🎨 Farbe' },
]
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-sm uppercase tracking-[0.2em] text-neutral-500">Labels</h1>
      <span v-if="data" class="text-xs text-neutral-500">{{ data.count.toLocaleString('de-DE') }} gelabelt</span>
    </div>

    <!-- Tabs -->
    <div v-if="data?.count" class="mb-4 flex gap-1 rounded-full border border-line p-1 w-fit">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="rounded-full px-4 py-1.5 text-xs transition"
        :class="tab === t.key ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
        @click="tab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Farbfamilien-Chips -->
    <div v-if="tab === 'color'" class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="f in families"
        :key="f.family"
        class="flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition"
        :class="activeFamily === f.family ? 'border-neutral-400 text-neutral-100' : 'border-line text-neutral-400 hover:text-neutral-200'"
        @click="activeFamily = f.family"
      >
        <span class="h-3 w-3 rounded-full border border-white/20" :style="{ background: f.hex }" />
        {{ f.family }} <span class="text-neutral-500">{{ f.count }}</span>
      </button>
    </div>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="!data?.count" class="text-sm text-neutral-500">
      Noch keine gelabelten Fotos. Lass den Labeler laufen.
    </p>

    <div
      v-else
      class="grid gap-1"
      style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))"
    >
      <button
        v-for="(p, i) in shown"
        :key="p.sha"
        class="group relative aspect-square overflow-hidden rounded-md border border-line bg-ink-soft"
        @click="open(i)"
      >
        <img
          :src="`/img/${p.sha}?w=400`"
          :alt="p.filename"
          loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:opacity-90"
        />
        <!-- Score-/Farb-Badge -->
        <div
          v-if="tab !== 'color'"
          class="absolute right-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium tabular-nums backdrop-blur"
          :class="p.blurry ? 'text-red-300' : 'text-neutral-200'"
        >
          {{ p.quality }}
        </div>
        <div v-else class="absolute right-1 top-1 flex gap-0.5">
          <span
            v-for="c in p.colors.slice(0, 3)"
            :key="c"
            class="h-2.5 w-2.5 rounded-full border border-white/30"
            :style="{ background: c }"
          />
        </div>
      </button>
    </div>

    <PhotoLightbox :photos="shown" v-model:index="openIndex" />
  </div>
</template>
