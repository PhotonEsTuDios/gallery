<script setup lang="ts">
import type { Pillar } from '~/composables/usePortfolio'

interface Photo {
  sha: string
  filename: string
  kind?: 'photo' | 'video'
}

const props = defineProps<{
  photos: Photo[]
  index: number | null
}>()
const emit = defineEmits<{ 'update:index': [number | null] }>()

const current = computed(() => (props.index === null ? null : props.photos[props.index] ?? null))
// gallery#14: Tasten +/− der Größenwahl ruhen, solange die Lightbox offen ist
const lightboxOpen = useLightboxOpen()
watch(() => props.index, (i) => { lightboxOpen.value = i !== null }, { immediate: true })
onUnmounted(() => { lightboxOpen.value = false })
const isVideo = computed(() => current.value?.kind === 'video')

// Video: presigned URL on demand laden
const videoUrl = ref<string | null>(null)
watch(current, async (c) => {
  videoUrl.value = null
  if (c?.kind === 'video') {
    try {
      const r = await $fetch<{ url: string }>(`/api/video/${c.sha}`)
      videoUrl.value = r.url
    } catch {
      videoUrl.value = null
    }
  }
})

function close() {
  emit('update:index', null)
}
function next() {
  if (props.index === null || !props.photos.length) return
  emit('update:index', (props.index + 1) % props.photos.length)
}
function prev() {
  if (props.index === null || !props.photos.length) return
  emit('update:index', (props.index - 1 + props.photos.length) % props.photos.length)
}

// Portfolio-Auswahl: Säule per Klick oder Taste 1–4, 0 entfernt
const { picks, error: pickError, load: loadPicks, toggle } = usePortfolio()
const currentPick = computed(() => (current.value ? picks.value[current.value.sha]?.pillar ?? null : null))
const currentInfo = computed(() => PILLAR_INFO.find((p) => p.key === currentPick.value) ?? null)
function pick(pillar: Pillar | null) {
  if (current.value) toggle(current.value, pillar)
}

// ---- Gesichter (gallery#9) -----------------------------------------------------
interface Face { sha: string; face: number; box?: number[]; person?: string; cluster?: string; crop: string }
const faces = ref<Face[]>([])
const showFaces = useState('lightbox-faces', () => false)
const editing = ref<Face | null>(null)
const faceName = ref('')
const faceBusy = ref(false)
const faceError = ref('')
const { data: knownNames } = useFetch<{ name: string; count: number }[]>('/api/personen/namen', { lazy: true, server: false, default: () => [] })
const peopleHere = computed(() => [...new Set(faces.value.map((f) => f.person).filter(Boolean))] as string[])
async function loadFaces(c: Photo | null) {
  faces.value = []
  editing.value = null
  if (!c || c.kind === 'video') return
  try {
    const r = await $fetch<{ sha: string; faces: Face[] }>(`/api/faces/${c.sha}`)
    if (current.value?.sha === r.sha) faces.value = r.faces
  } catch {
    faces.value = []
  }
}
watch(current, loadFaces, { immediate: true })
function editFace(f: Face) {
  editing.value = f
  faceName.value = f.person ?? ''
  faceError.value = ''
}
async function saveFace(mode: 'name_face' | 'reject') {
  const f = editing.value
  if (!f) return
  faceBusy.value = true
  faceError.value = ''
  try {
    await postSigned('/api/personen', { actions: [mode === 'reject' ? { mode, sha: f.sha, face: f.face } : { mode, sha: f.sha, face: f.face, person: faceName.value.trim() }] })
    if (mode === 'reject') faces.value = faces.value.filter((x) => x !== f)
    else f.person = faceName.value.trim() || undefined
    editing.value = null
  } catch (e: any) {
    faceError.value = e?.data?.statusMessage || 'Speichern fehlgeschlagen'
  } finally {
    faceBusy.value = false
  }
}

function onKey(e: KeyboardEvent) {
  if (props.index === null) return
  // beim Tippen (Name eingeben) keine Tastenkürzel auslösen
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (e.key === 'Escape') editing.value = null
    return
  }
  if (e.key === 'g' || e.key === 'G') { showFaces.value = !showFaces.value; return }
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key >= '1' && e.key <= '4') pick(PILLAR_INFO[Number(e.key) - 1].key)
  else if (e.key === '0') pick(null)
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  loadPicks()
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="current"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      @click.self="close"
    >
      <button class="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-2xl text-neutral-400 hover:text-white" @click="prev">‹</button>
      <button class="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-2xl text-neutral-400 hover:text-white" @click="next">›</button>
      <button class="absolute right-4 top-4 p-2 text-sm text-neutral-400 hover:text-white" @click="close">✕</button>

      <!-- Video -->
      <video
        v-if="isVideo"
        :key="current.sha"
        :src="videoUrl || undefined"
        controls
        autoplay
        playsinline
        class="max-h-[88vh] max-w-[92vw] bg-black"
      />
      <p v-if="isVideo && !videoUrl" class="absolute text-sm text-neutral-400">Video lädt…</p>

      <!-- Bild (gallery#6: explizit v-if — ein v-else hing am „Video lädt…“-Hinweis darüber
           und zeigte bei geladenem Video zusätzlich ein kaputtes <img>) -->
      <div v-if="!isVideo" class="relative inline-block" data-test="lightbox-image">
        <img
          :src="`/img/${current.sha}?w=1600`"
          :alt="current.filename"
          class="block max-h-[88vh] max-w-[92vw] object-contain"
        />
        <!-- Gesichter-Rahmen (gallery#9): Box relativ 0..1 zum (EXIF-gedrehten) Bild -->
        <template v-if="showFaces">
          <button
            v-for="f in faces"
            :key="f.face"
            class="absolute rounded-sm border-2 transition"
            :class="editing === f ? 'border-amber-300' : f.person ? 'border-white/80 hover:border-white' : 'border-white/40 border-dashed hover:border-white'"
            :style="{ left: `${(f.box?.[0] ?? 0) * 100}%`, top: `${(f.box?.[1] ?? 0) * 100}%`, width: `${(f.box?.[2] ?? 0) * 100}%`, height: `${(f.box?.[3] ?? 0) * 100}%` }"
            :title="f.person || 'unbekannt – klicken zum Benennen'"
            data-test="face-box"
            @click.stop="editFace(f)"
          >
            <span class="absolute left-0 top-full mt-0.5 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{{ f.person || '?' }}</span>
          </button>
        </template>
      </div>

      <!-- Personen auf dem Foto + Gesichter-Schalter (gallery#9) -->
      <div v-if="!isVideo && faces.length" class="absolute left-4 top-4 flex max-w-[70vw] flex-wrap items-center gap-2 text-xs" data-test="faces-bar">
        <button
          class="rounded-full border px-3 py-1 transition"
          :class="showFaces ? 'border-neutral-300 text-neutral-100' : 'border-line text-neutral-400 hover:text-neutral-200'"
          title="Gesichter zeigen (Taste G)"
          @click="showFaces = !showFaces"
        >
          ☺ {{ faces.length }}
        </button>
        <NuxtLink
          v-for="p in peopleHere"
          :key="p"
          :to="{ path: '/timeline', query: { p } }"
          class="rounded-full bg-black/60 px-3 py-1 text-neutral-200 hover:bg-black/80"
          @click="close"
        >
          {{ p }}
        </NuxtLink>
      </div>

      <!-- Gesicht benennen -->
      <form
        v-if="editing"
        class="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-ink/90 p-1.5 pl-2 text-xs backdrop-blur"
        data-test="face-edit"
        @submit.prevent="saveFace('name_face')"
      >
        <img :src="`/face/${editing.crop}`" alt="" class="h-7 w-7 rounded-full object-cover" />
        <input
          v-model="faceName"
          list="lightbox-names"
          placeholder="Wer ist das?"
          autofocus
          class="w-40 bg-transparent px-1 text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />
        <datalist id="lightbox-names"><option v-for="n in knownNames" :key="n.name" :value="n.name" /></datalist>
        <button type="submit" class="rounded-full bg-neutral-100 px-3 py-1 text-black disabled:opacity-50" :disabled="faceBusy">{{ faceBusy ? '…' : 'Speichern' }}</button>
        <button type="button" class="px-2 text-neutral-400 hover:text-red-300" title="kein Gesicht / falsch erkannt" :disabled="faceBusy" @click="saveFace('reject')">kein Gesicht</button>
        <button type="button" class="px-2 text-neutral-500 hover:text-white" @click="editing = null">✕</button>
        <span v-if="faceError" class="pr-2 text-red-400">{{ faceError }}</span>
      </form>

      <!-- Portfolio-Säulen -->
      <div class="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <p v-if="pickError" class="text-xs text-red-400">{{ pickError }}</p>
        <p v-else-if="currentInfo?.consent" class="text-xs text-amber-300/90">Vor dem Posten: Freigabe der Person einholen</p>
        <div class="flex items-center gap-1 rounded-full border border-line bg-ink/80 p-1 backdrop-blur" data-test="pillars">
          <button
            v-for="(p, i) in PILLAR_INFO"
            :key="p.key"
            :title="`${p.hint} (Taste ${i + 1})`"
            class="rounded-full px-3 py-1.5 text-xs transition"
            :class="currentPick === p.key ? 'bg-neutral-100 text-black' : 'text-neutral-300 hover:bg-neutral-800'"
            @click="pick(p.key)"
          >
            <span class="mr-1 text-neutral-500">{{ i + 1 }}</span>{{ p.label }}
          </button>
        </div>
      </div>

      <a
        :href="isVideo ? (videoUrl || '#') : `/img/${current.sha}?dl=1`"
        :target="isVideo ? '_blank' : undefined"
        rel="noopener"
        class="absolute bottom-5 right-5 rounded-full border border-line bg-ink/80 px-4 py-2 text-xs text-neutral-200 backdrop-blur transition hover:border-neutral-500"
      >
        ↓ Original
      </a>
    </div>
  </Teleport>
</template>
