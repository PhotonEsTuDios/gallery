<script setup lang="ts">
// Personen benennen (gallery#7): Gruppen aus der Gesichtserkennung (staubsauger#14).
// Benennen = Name an alle Gesichter der Gruppe; Zusammenführen = zweite Gruppe gleich benennen.
interface Group { cluster: string; size: number; photos: number; person: string | null; samples: string[] }
interface Named { person: string; clusters: string[]; size: number; photos: number; samples: string[] }
interface Page { generated_at?: string; named: Named[]; groups: Group[]; total: number; next: number | null }
interface Face { sha: string; face: number; crop: string; person?: string }

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
  if (e.key === 'Escape') review.value = null
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

const input = reactive<Record<string, string>>({})
async function nameGroup(g: Group) {
  const person = (input[g.cluster] || '').trim()
  if (!person) return
  if (await act(g.cluster, 'speichert…', [{ mode: 'name', cluster: g.cluster, person }])) {
    groups.value = groups.value.filter((x) => x.cluster !== g.cluster)
    total.value--
    const n = named.value.find((x) => x.person === person)
    if (n) { n.clusters.push(g.cluster); n.size += g.size; n.photos += g.photos }
    else named.value.unshift({ person, clusters: [g.cluster], size: g.size, photos: g.photos, samples: g.samples.slice(0, 4) })
  }
}
async function hideGroup(g: Group) {
  if (await act(g.cluster, 'blendet aus…', [{ mode: 'hide', cluster: g.cluster }])) {
    groups.value = groups.value.filter((x) => x.cluster !== g.cluster)
    total.value--
  }
}

// Prüfen: alle Gesichter einer Gruppe, falsche markieren und entfernen
const review = ref<{ group: Group; faces: Face[]; wrong: Set<string> } | null>(null)
async function openReview(g: Group) {
  review.value = { group: g, faces: [], wrong: new Set() }
  const r = await $fetch<{ faces: Face[] }>(`/api/personen/${g.cluster}`)
  if (review.value?.group.cluster === g.cluster) review.value.faces = r.faces
}
function toggleWrong(f: Face) {
  const w = review.value!.wrong
  const k = `${f.sha}_${f.face}`
  w.has(k) ? w.delete(k) : w.add(k)
}
async function removeWrong() {
  const r = review.value!
  const actions = r.faces.filter((f) => r.wrong.has(`${f.sha}_${f.face}`)).map((f) => ({ mode: 'reject', sha: f.sha, face: f.face }))
  for (let i = 0; i < actions.length; i += 50) {
    if (!(await act(r.group.cluster, 'entfernt…', actions.slice(i, i + 50)))) return
  }
  r.faces = r.faces.filter((f) => !r.wrong.has(`${f.sha}_${f.face}`))
  r.group.size = r.faces.length
  r.wrong = new Set()
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
        <NuxtLink
          v-for="n in named"
          :key="n.person"
          :to="{ path: '/timeline', query: { p: n.person } }"
          class="group overflow-hidden rounded-xl border border-line transition hover:border-neutral-500"
        >
          <div class="grid grid-cols-2">
            <img v-for="s in n.samples.slice(0, 4)" :key="s" :src="crop(s)" alt="" loading="lazy" class="aspect-square w-full object-cover" />
          </div>
          <div class="p-2">
            <div class="truncate text-sm font-medium">{{ n.person }}</div>
            <div class="text-xs text-neutral-500">{{ n.photos }} Fotos · Timeline →</div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Unbenannte Gruppen -->
    <section>
      <h2 class="mb-1 border-b border-line pb-2 text-lg font-medium">
        Wer ist das? <span class="text-xs text-neutral-500">{{ total }} Gruppen, größte zuerst</span>
      </h2>
      <p class="mb-4 text-xs text-neutral-500">
        Namen eintippen + Enter. Gleicher Name bei zwei Gruppen = zusammengeführt. „Prüfen“ zeigt alle Gesichter, falsche lassen sich entfernen.
      </p>
      <p v-if="!loading && !groups.length && !named.length" class="text-sm text-neutral-500">Noch keine Gruppen — die Gesichtserkennung gruppiert täglich um 06:00 UTC.</p>

      <datalist id="person-names"><option v-for="n in names" :key="n" :value="n" /></datalist>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" data-test="groups">
        <div v-for="g in groups" :key="g.cluster" class="overflow-hidden rounded-xl border border-line" :class="busy[g.cluster] ? 'opacity-50' : ''">
          <div class="grid grid-cols-2">
            <img v-for="s in g.samples.slice(0, 4)" :key="s" :src="crop(s)" alt="" loading="lazy" class="aspect-square w-full object-cover" />
          </div>
          <div class="space-y-2 p-2">
            <div class="text-xs text-neutral-500">{{ g.photos }} Fotos · {{ g.size }} Gesichter</div>
            <form @submit.prevent="nameGroup(g)">
              <input
                v-model="input[g.cluster]"
                list="person-names"
                placeholder="Name…"
                :disabled="!!busy[g.cluster]"
                class="w-full rounded-md border border-line bg-transparent px-2 py-1 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
              />
            </form>
            <div class="flex justify-between text-xs">
              <button class="text-neutral-400 hover:text-neutral-100" @click="openReview(g)">Prüfen</button>
              <span v-if="busy[g.cluster]" class="text-neutral-500">{{ busy[g.cluster] }}</span>
              <button class="text-neutral-500 hover:text-neutral-200" title="Fremde, Publikum: nicht mehr zeigen" @click="hideGroup(g)">Ausblenden</button>
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

    <!-- Prüfen-Dialog -->
    <Teleport to="body">
      <div v-if="review" class="fixed inset-0 z-50 overflow-y-auto bg-black/95 p-5" data-test="review" @click.self="review = null">
        <div class="mx-auto max-w-6xl">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-sm text-neutral-300">
              Gruppe {{ review.group.cluster }} · {{ review.faces.length }} Gesichter — falsche anklicken
            </h2>
            <div class="flex items-center gap-3 text-xs">
              <button
                class="rounded-full border px-4 py-1.5 transition"
                :class="review.wrong.size ? 'border-red-400 text-red-300 hover:bg-red-400/10' : 'border-line text-neutral-600'"
                :disabled="!review.wrong.size || !!busy[review.group.cluster]"
                @click="removeWrong"
              >
                {{ busy[review.group.cluster] || `${review.wrong.size} entfernen` }}
              </button>
              <button class="text-neutral-400 hover:text-white" @click="review = null">✕ schließen</button>
            </div>
          </div>
          <p v-if="!review.faces.length" class="text-sm text-neutral-500">Lade…</p>
          <div class="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            <button
              v-for="f in review.faces"
              :key="`${f.sha}_${f.face}`"
              class="relative overflow-hidden rounded-md border-2 transition"
              :class="review.wrong.has(`${f.sha}_${f.face}`) ? 'border-red-400 opacity-40' : 'border-transparent hover:border-neutral-500'"
              @click="toggleWrong(f)"
            >
              <img :src="`/face/${f.crop}`" alt="" loading="lazy" class="aspect-square w-full object-cover" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
