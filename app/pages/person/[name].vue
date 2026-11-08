<script setup lang="ts">
// Personen-Album-Vorschlag (gallery#15): ~100 portraitartige Fotos, zeitlich gestreut, ohne Überschriften.
// „Neu mischen“ = neuer Seed (steht in der URL, Neuladen zeigt denselben Vorschlag). Speichern -> Meine Alben.
interface Photo { sha: string; filename: string; taken_at: string | null; kind: 'photo' | 'video' }
interface Suggestion { person: string; seed: number; candidates: number; photos: Photo[] }

const route = useRoute()
const router = useRouter()
const person = computed(() => String(route.params.name || ''))
const seed = computed(() => Number(route.query.seed) || 1)
const data = shallowRef<Suggestion | null>(null)
const pending = ref(true)
const error = ref('')
let run = 0
async function load() {
  const mine = ++run
  pending.value = true
  error.value = ''
  try {
    const r = await $fetch<Suggestion>(`/api/person/${encodeURIComponent(person.value)}/vorschlag`, { query: { seed: seed.value } })
    if (mine === run) data.value = r
  } catch (e: any) {
    if (mine === run) error.value = e?.data?.statusMessage || 'Vorschlag konnte nicht geladen werden'
  } finally {
    if (mine === run) pending.value = false
  }
}
onMounted(load)
watch([person, seed], load)

function shuffle() {
  router.replace({ query: { ...route.query, seed: String(Math.floor(Math.random() * 2 ** 31)) } })
  saved.value = null
}

// Speichern
const saving = ref(false)
const albumName = ref('')
const askName = ref(false)
const saved = ref<string | null>(null)
watch(person, (p) => { albumName.value = `${p} – Portraits` }, { immediate: true })
async function save() {
  if (!data.value) return
  saving.value = true
  error.value = ''
  try {
    const r = await postSigned<{ album: { name: string } }>('/api/albums/saved', { name: albumName.value.trim(), person: person.value, shas: data.value.photos.map((p) => p.sha) })
    saved.value = r.album.name
    askName.value = false
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Speichern fehlgeschlagen'
  } finally {
    saving.value = false
  }
}

const { thumbW, gridStyle } = useDensity()
const openIndex = ref<number | null>(null)
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <NuxtLink to="/personen" class="text-neutral-500 transition hover:text-neutral-200">←</NuxtLink>
      <h1 class="text-sm font-medium">{{ person }}</h1>
      <span v-if="data" class="text-xs text-neutral-500">Album-Vorschlag · {{ data.photos.length }} aus {{ data.candidates.toLocaleString('de-DE') }} Fotos · portraitartig, zeitlich sortiert</span>
      <div class="ml-auto flex flex-wrap items-center gap-2">
        <DensityToggle />
        <button data-test="shuffle" class="rounded-full border border-line px-4 py-1.5 text-xs text-neutral-200 hover:border-neutral-400" :disabled="pending" @click="shuffle">↻ Neu mischen</button>
        <button v-if="!askName" data-test="save" class="rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-medium text-black hover:bg-white" :disabled="pending || !data?.photos.length" @click="askName = true">Als Album speichern</button>
        <form v-else class="flex items-center gap-2" @submit.prevent="save">
          <input v-model="albumName" data-test="album-name" class="w-56 rounded-md border border-line bg-transparent px-2 py-1 text-sm text-neutral-100 focus:border-neutral-400 focus:outline-none" />
          <button data-test="save-confirm" class="rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-medium text-black hover:bg-white" :disabled="saving">{{ saving ? 'speichert…' : 'Speichern' }}</button>
          <button type="button" class="text-xs text-neutral-500 hover:text-neutral-200" @click="askName = false">abbrechen</button>
        </form>
      </div>
    </div>
    <p v-if="saved" class="mb-4 rounded-md border border-emerald-700/60 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300" data-test="saved">
      ✓ Gespeichert als <NuxtLink :to="`/album/${encodeURIComponent(saved)}`" class="underline">{{ saved }}</NuxtLink> — steht unter Alben → Meine Alben.
    </p>
    <p v-if="error" class="mb-4 text-sm text-red-400">{{ error }}</p>
    <p v-if="pending && !data" class="text-sm text-neutral-500">Suche Portraits…</p>
    <p v-else-if="data && !data.photos.length" class="text-sm text-neutral-500">Noch keine Fotos mit Datum für {{ person }}.</p>

    <div v-if="data" :style="gridStyle" :class="pending ? 'opacity-50' : ''" data-test="grid">
      <button
        v-for="(p, i) in data.photos"
        :key="p.sha"
        class="group relative aspect-square overflow-hidden rounded-md border border-line bg-ink-soft"
        :title="p.taken_at?.slice(0, 10) || ''"
        @click="openIndex = i"
      >
        <img :src="`/img/${p.sha}?w=${thumbW}`" :alt="p.filename" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:opacity-90" />
      </button>
    </div>

    <PhotoLightbox v-if="data" :photos="data.photos" v-model:index="openIndex" />
  </div>
</template>
