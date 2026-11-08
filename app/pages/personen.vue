<script setup lang="ts">
// Personen benennen (gallery#7): Gruppen aus der Gesichtserkennung (staubsauger#14).
// Benennen (gallery#10): Gruppe anklicken -> Name -> falsche anklicken -> Speichern. Gleicher Name = zusammengeführt.
interface Group { cluster: string; size: number; photos: number; person: string | null; samples: string[] }
interface Named { person: string; clusters: string[]; size: number; photos: number; samples: string[] }
interface Page { generated_at?: string; named: Named[]; groups: Group[]; total: number; next: number | null }

const named = ref<Named[]>([])
const groups = ref<Group[]>([])
const total = ref(0)
const next = ref<number | null>(0)
const generatedAt = ref('')
const loading = ref(false)
const busy = reactive<Record<string, string>>({}) // cluster -> laufende Aktion
const error = ref('')

const crop = (key: string) => `/face/${key.replace(/^faces\//, '').replace(/\.jpg$/, '')}`

async function load(reset = false) {
  if (loading.value || (!reset && next.value === null)) return
  loading.value = true
  try {
    const p = await $fetch<Page>('/api/personen', { query: { offset: reset ? 0 : next.value } })
    named.value = p.named
    groups.value = reset ? p.groups : groups.value.concat(p.groups)
    total.value = p.total
    next.value = p.next
    generatedAt.value = p.generated_at ?? ''
  } catch (e: any) {
    error.value = e?.statusMessage || 'Laden fehlgeschlagen'
  } finally {
    loading.value = false
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && dlg.value) closeDialog()
}
onMounted(() => {
  load(true)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

async function act(cluster: string, label: string, actions: Record<string, unknown>[]) {
  busy[cluster] = label
  error.value = ''
  try {
    await postSigned('/api/personen', { actions })
    return true
  } catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Speichern fehlgeschlagen'
    return false
  } finally {
    delete busy[cluster]
  }
}

async function hideGroup(g: Group) {
  if (await act(g.cluster, 'blendet aus…', [{ mode: 'hide', cluster: g.cluster }])) {
    groups.value = groups.value.filter((x) => x.cluster !== g.cluster)
    total.value--
  }
}

// Benennen (gallery#10): Name eintragen -> wer NICHT die Person ist anklicken -> Speichern.
// Gezeigt wird eine Stichprobe (40, wahrscheinlich falsche zuerst); Ähnliche im Rest nimmt photon-faces mit raus.
interface Sample { sha: string; face: number; crop: string }
const key = (f: { sha: string; face: number }) => `${f.sha}_${f.face}`
const dlg = ref<{ group: Group; person: string; faces: Sample[]; wrong: Set<string>; next: number | null; loading: boolean; error: string } | null>(null)
const notice = ref('')
async function openDialog(g: Group) {
  dlg.value = { group: g, person: '', faces: [], wrong: new Set(), next: 0, loading: false, error: '' }
  await nextTick()
  ;(document.querySelector('[data-test=dlg-name]') as HTMLInputElement | null)?.focus()
  await more()
}
async function more() {
  const d = dlg.value
  if (!d || d.loading || d.next === null) return
  d.loading = true
  try {
    const r = await $fetch<{ faces: Sample[]; next: number | null }>(`/api/personen/${d.group.cluster}`, { query: { offset: d.next } })
    if (dlg.value !== d) return
    d.faces = d.faces.concat(r.faces)
    d.next = r.next
  } catch (e: any) {
    d.error = e?.data?.statusMessage || 'Gesichter laden fehlgeschlagen'
  } finally {
    d.loading = false
  }
}
function toggle(f: Sample) {
  const w = dlg.value!.wrong
  w.has(key(f)) ? w.delete(key(f)) : w.add(key(f))
}
function closeDialog() {
  const d = dlg.value
  if (d && (d.wrong.size || d.person.trim()) && !busy[d.group.cluster] && !confirm('Nicht gespeichert — wirklich schließen?')) return
  dlg.value = null
}
async function saveDialog() {
  const d = dlg.value
  if (!d) return
  const person = d.person.trim()
  if (!person) { d.error = 'Bitte zuerst den Namen eintragen'; return }
  const g = d.group
  const wrong = d.faces.filter((f) => d.wrong.has(key(f))).map(({ sha, face }) => ({ sha, face }))
  const shown = d.faces.map(({ sha, face }) => ({ sha, face }))
  busy[g.cluster] = 'speichert…'
  d.error = ''
  try {
    const r = await postSigned<{ results: any[] }>('/api/personen', { actions: [{ mode: 'confirm', cluster: g.cluster, person, wrong, shown }] })
    const res = r.results?.[0] ?? {}
    groups.value = groups.value.filter((x) => x.cluster !== g.cluster)
    total.value--
    const n = named.value.find((x) => x.person === person)
    const size = res.queued ? g.size - wrong.length : res.faces
    const photos = res.queued ? g.photos : res.photos
    if (n) { n.clusters.push(g.cluster); n.size += size; n.photos += photos }
    else named.value.unshift({ person, clusters: [g.cluster], size, photos, samples: g.samples.slice(0, 4) })
    if (res.queued) {
      notice.value = `✓ ${person} gespeichert — große Gruppe, wird im Hintergrund übernommen (ca. 1 Min.)`
    } else {
      const out = (res.removed || 0) + (res.auto_removed || 0)
      notice.value = `✓ ${person}: ${res.faces} Gesichter auf ${res.photos} Fotos` + (out ? ` · ${res.removed} markierte + ${res.auto_removed} ähnliche entfernt` : '')
    }
    dlg.value = null
  } catch (e: any) {
    d.error = e?.data?.statusMessage || e?.statusMessage || 'Speichern fehlgeschlagen — bitte nochmal'
  } finally {
    delete busy[g.cluster]
  }
}

const names = computed(() => named.value.map((n) => n.person))
const when = computed(() => (generatedAt.value ? new Date(generatedAt.value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : ''))
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-6 flex flex-wrap items-baseline justify-between gap-2">
      <h1 class="text-sm uppercase tracking-[0.2em] text-neutral-500">Personen</h1>
      <span v-if="when" class="text-xs text-neutral-500">gruppiert {{ when }} · täglich neu</span>
    </div>
    <p v-if="error" class="mb-4 text-sm text-red-400">{{ error }}</p>

    <!-- Benannte Personen -->
    <section v-if="named.length" class="mb-10">
      <h2 class="mb-3 border-b border-line pb-2 text-lg font-medium">Benannt <span class="text-xs text-neutral-500">{{ named.length }}</span></h2>
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" data-test="named">
        <div
          v-for="n in named"
          :key="n.person"
          class="group overflow-hidden rounded-xl border border-line transition hover:border-neutral-500"
        >
          <NuxtLink :to="`/person/${encodeURIComponent(n.person)}`" class="grid grid-cols-2" title="Album-Vorschlag">
            <img v-for="s in n.samples.slice(0, 4)" :key="s" :src="crop(s)" alt="" loading="lazy" class="aspect-square w-full object-cover" />
          </NuxtLink>
          <div class="p-2">
            <div class="truncate text-sm font-medium">{{ n.person }}</div>
            <div class="flex justify-between text-xs text-neutral-500">
              <NuxtLink :to="{ path: '/timeline', query: { p: n.person } }" class="hover:text-neutral-200">{{ n.photos }} Fotos · Timeline</NuxtLink>
              <NuxtLink :to="`/person/${encodeURIComponent(n.person)}`" class="text-neutral-300 hover:text-white" data-test="person-album">Album →</NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Unbenannte Gruppen -->
    <section>
      <h2 class="mb-1 border-b border-line pb-2 text-lg font-medium">
        Wer ist das? <span class="text-xs text-neutral-500">{{ total }} Gruppen, größte zuerst</span>
      </h2>
      <p class="mb-4 text-xs text-neutral-500">
        Gruppe anklicken → Namen eintragen → wer <b>nicht</b> die Person ist anklicken → Speichern. Gleicher Name bei zwei Gruppen = zusammengeführt.
      </p>
      <p v-if="notice" class="mb-4 rounded-md border border-emerald-700/60 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300" data-test="notice">{{ notice }}</p>
      <p v-if="!loading && !groups.length && !named.length" class="text-sm text-neutral-500">Noch keine Gruppen — die Gesichtserkennung gruppiert täglich um 06:00 UTC.</p>

      <datalist id="person-names"><option v-for="n in names" :key="n" :value="n" /></datalist>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-test="groups">
        <div v-for="g in groups" :key="g.cluster" class="overflow-hidden rounded-xl border border-line" :class="busy[g.cluster] ? 'opacity-50' : ''">
          <button class="grid w-full grid-cols-2" title="Benennen" @click="openDialog(g)">
            <img v-for="s in g.samples.slice(0, 4)" :key="s" :src="crop(s)" alt="" loading="lazy" class="aspect-square w-full object-cover" />
          </button>
          <div class="space-y-2 p-2">
            <div class="text-xs text-neutral-500">{{ g.photos }} Fotos · {{ g.size }} Gesichter</div>
            <div class="flex items-center justify-between text-xs">
              <button class="rounded-full border border-line px-3 py-1 text-neutral-200 hover:border-neutral-400" data-test="benennen" @click="openDialog(g)">Wer ist das?</button>
              <span v-if="busy[g.cluster]" class="text-neutral-500">{{ busy[g.cluster] }}</span>
              <button v-else class="text-neutral-500 hover:text-neutral-200" title="Fremde, Publikum: nicht mehr zeigen" @click="hideGroup(g)">Ausblenden</button>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-6 text-center">
        <button v-if="next !== null" class="rounded-full border border-line px-4 py-2 text-xs text-neutral-300 hover:border-neutral-500" :disabled="loading" @click="load()">
          {{ loading ? 'Lade…' : 'Weitere Gruppen' }}
        </button>
      </div>
    </section>

    <!-- Benennen-Dialog (gallery#10) -->
    <Teleport to="body">
      <div v-if="dlg" class="fixed inset-0 z-50 overflow-y-auto bg-black/95 p-5" data-test="review" @click.self="closeDialog">
        <div class="mx-auto max-w-6xl">
          <div class="sticky top-0 z-10 -mx-5 mb-4 space-y-3 bg-black/95 px-5 py-3">
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs text-neutral-500">1. Wer ist das?</span>
              <input
                v-model="dlg.person"
                data-test="dlg-name"
                list="person-names"
                placeholder="Name…"
                autocomplete="off"
                class="min-w-0 flex-1 rounded-md border border-line bg-transparent px-3 py-2 text-base text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-400 focus:outline-none sm:max-w-xs"
                @keydown.enter.prevent
              />
              <button
                data-test="dlg-save"
                class="rounded-full px-5 py-2 text-sm font-medium transition"
                :class="dlg.person.trim() ? 'bg-neutral-100 text-black hover:bg-white' : 'bg-neutral-800 text-neutral-500'"
                :disabled="!!busy[dlg.group.cluster]"
                @click="saveDialog"
              >
                {{ busy[dlg.group.cluster] || (dlg.person.trim() ? `Speichern${dlg.wrong.size ? ` · ${dlg.wrong.size} ausnehmen` : ''}` : 'Speichern') }}
              </button>
              <button class="ml-auto text-xs text-neutral-400 hover:text-white" @click="closeDialog">✕ schließen</button>
            </div>
            <p class="text-xs text-neutral-400">
              2. Anklicken, wer <b>nicht</b> {{ dlg.person.trim() || 'die Person' }} ist. Gezeigt: {{ dlg.faces.length }} von {{ dlg.group.size }}, unsichere zuerst. Ähnliche im Rest nimmt die Erkennung beim Speichern automatisch mit raus.
            </p>
            <p v-if="dlg.error" class="text-sm text-red-400" data-test="dlg-error">{{ dlg.error }}</p>
          </div>
          <p v-if="!dlg.faces.length && dlg.loading" class="text-sm text-neutral-500">Lade…</p>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
            <button
              v-for="f in dlg.faces"
              :key="key(f)"
              class="relative overflow-hidden rounded-md border-2 transition"
              :class="dlg.wrong.has(key(f)) ? 'border-red-500' : 'border-transparent hover:border-neutral-500'"
              @click="toggle(f)"
            >
              <img :src="`/face/${f.crop}`" alt="" loading="lazy" class="aspect-square w-full object-cover" :class="dlg.wrong.has(key(f)) ? 'opacity-30' : ''" />
              <span v-if="dlg.wrong.has(key(f))" class="absolute inset-0 flex items-center justify-center text-3xl font-bold text-red-500">✕</span>
            </button>
          </div>
          <div class="mt-5 text-center">
            <button v-if="dlg.next !== null" class="rounded-full border border-line px-4 py-2 text-xs text-neutral-300 hover:border-neutral-500" :disabled="dlg.loading" @click="more">
              {{ dlg.loading ? 'Lade…' : 'Mehr zeigen' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
