<script setup lang="ts">
// Personen-Album-Vorschlag (gallery#15): ~100 portraitartige Fotos, zeitlich gestreut, ohne Überschriften.
// „Neu mischen“ = neuer Seed (steht in der URL, Neuladen zeigt denselben Vorschlag). Speichern -> Meine Alben.
interface Photo { sha: string; face: number; filename: string; taken_at: string | null; kind: 'photo' | 'video' }
interface Suggestion { person: string; seed: number; candidates: number; photos: Photo[] }

const route = useRoute()
const router = useRouter()
const person = computed(() => String(route.params.name || ''))
const seed = computed(() => Number(route.query.seed) || 1)
const data = shallowRef<Suggestion | null>(null)
const pending = ref(true)
const error = ref('')
let run = 0
async function load(quiet = false) {
  const mine = ++run
  if (!quiet) pending.value = true
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

// Reihenfolge (Daten kommen älteste zuerst) + Zeitspanne sichtbar machen
const newestFirst = ref(false)
const shown = computed(() => (newestFirst.value ? [...(data.value?.photos ?? [])].reverse() : data.value?.photos ?? []))
const span = computed(() => {
  const t = (data.value?.photos ?? []).map((p) => p.taken_at?.slice(0, 4)).filter(Boolean) as string[]
  return t.length ? (newestFirst.value ? `${t.at(-1)} → ${t[0]}` : `${t[0]} → ${t.at(-1)}`) : ''
})

// „✕ nicht <Person>“ (gallery#16): Gesicht + Ähnliche raus, Erkennung merkt es sich; Lücke füllt sich nach
const removing = reactive<Record<string, boolean>>({})
const note = ref('')
async function notPerson(p: Photo) {
  removing[p.sha] = true
  try {
    const r = await postSigned<{ results: { removed: number; auto_removed: number }[] }>('/api/personen', { actions: [{ mode: 'not_person', sha: p.sha, face: p.face, person: person.value }] })
    const res = r.results?.[0]
    if (data.value) data.value = { ...data.value, photos: data.value.photos.filter((x) => x.sha !== p.sha) }
    note.value = `✓ Nicht ${person.value} – gemerkt` + (res?.auto_removed ? ` (+${res.auto_removed} ähnliche Gesichter auch entfernt)` : '')
    load(true) // gleicher Seed: Lücke füllt sich
  } catch (e: any) {
    error.value = e?.data?.statusMessage || 'Entfernen fehlgeschlagen'
  } finally {
    delete removing[p.sha]
  }
}

const { cell, thumbW, gridStyle } = useDensity()
const openIndex = ref<number | null>(null)
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <NuxtLink to="/personen" class="text-neutral-500 transition hover:text-neutral-200">←</NuxtLink>
      <h1 class="text-sm font-medium">{{ person }}</h1>
      <span v-if="data" class="text-xs text-neutral-500">Album-Vorschlag · {{ data.photos.length }} aus {{ data.candidates.toLocaleString('de-DE') }} Fotos · portraitartig</span>
      <button v-if="span" class="rounded-full border border-line px-3 py-1 text-xs text-neutral-300 hover:border-neutral-400" data-test="order" :title="newestFirst ? 'auf älteste zuerst umschalten' : 'auf neueste zuerst umschalten'" @click="newestFirst = !newestFirst">
        {{ span }} · {{ newestFirst ? 'neueste zuerst' : 'älteste zuerst' }} ⇅
      </button>
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
    <p v-if="note" class="mb-4 text-sm text-emerald-300" data-test="note">{{ note }}</p>
    <p v-if="error" class="mb-4 text-sm text-red-400">{{ error }}</p>
    <p v-if="pending && !data" class="text-sm text-neutral-500">Suche Portraits…</p>
    <p v-else-if="data && !data.photos.length" class="text-sm text-neutral-500">Noch keine Fotos mit Datum für {{ person }}.</p>

    <div v-if="data" :style="gridStyle" :class="pending ? 'opacity-50' : ''" data-test="grid">
      <div
        v-for="(p, i) in shown"
        :key="p.sha"
        class="group relative aspect-square overflow-hidden rounded-md border border-line bg-ink-soft"
        :class="removing[p.sha] ? 'opacity-30' : ''"
      >
        <button class="h-full w-full" :title="p.taken_at?.slice(0, 10) || ''" @click="openIndex = i">
          <img :src="`/img/${p.sha}?w=${thumbW}`" :alt="p.filename" loading="lazy" class="h-full w-full object-cover transition duration-300 group-hover:opacity-90" />
        </button>
        <span v-if="cell >= 78 && p.taken_at" class="pointer-events-none absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] tabular-nums text-neutral-200">{{ p.taken_at.slice(0, 4) }}</span>
        <button
          data-test="not-person"
          class="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] text-neutral-100 opacity-0 transition hover:bg-red-600 group-hover:opacity-100"
          :title="`Das ist nicht ${person} – merken und ähnliche Gesichter mit entfernen`"
          :disabled="removing[p.sha]"
          @click.stop="notPerson(p)"
        >
          ✕<span v-if="cell >= 120"> nicht {{ person }}</span>
        </button>
      </div>
    </div>
    <p v-if="data?.photos.length" class="mt-4 text-center text-xs text-neutral-500">{{ data.photos.length }} Fotos · {{ span }}</p>

    <PhotoLightbox v-if="data" :photos="shown" v-model:index="openIndex" />
  </div>
</template>
