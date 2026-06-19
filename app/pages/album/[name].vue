<script setup lang="ts">
interface Photo {
  sha: string
  filename: string
  bytes: number
  uploaded_at: string
  taken_at: string | null
}
interface AlbumData {
  name: string
  count: number
  photos: Photo[]
}

const route = useRoute()
const name = computed(() => route.params.name as string)
const { data: album, pending, error } = await useFetch<AlbumData>(() => `/api/album/${name.value}`)

// Lightbox
const openIndex = ref<number | null>(null)
const current = computed(() => (openIndex.value === null ? null : album.value?.photos[openIndex.value] ?? null))

function open(i: number) {
  openIndex.value = i
}
function close() {
  openIndex.value = null
}
function next() {
  if (openIndex.value === null || !album.value) return
  openIndex.value = (openIndex.value + 1) % album.value.photos.length
}
function prev() {
  if (openIndex.value === null || !album.value) return
  openIndex.value = (openIndex.value - 1 + album.value.photos.length) % album.value.photos.length
}

function onKey(e: KeyboardEvent) {
  if (openIndex.value === null) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-6 flex items-center gap-3">
      <NuxtLink to="/" class="text-neutral-500 transition hover:text-neutral-200">←</NuxtLink>
      <h1 class="text-sm font-medium">{{ album?.name || name }}</h1>
      <span v-if="album" class="text-xs text-neutral-500">{{ album.count }} Fotos</span>
    </div>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="error" class="text-sm text-red-400">Album nicht gefunden.</p>

    <div v-else class="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
      <button
        v-for="(p, i) in album?.photos"
        :key="p.sha"
        class="block w-full overflow-hidden rounded-lg border border-line"
        @click="open(i)"
      >
        <img
          :src="`/img/${p.sha}?w=400`"
          :alt="p.filename"
          loading="lazy"
          class="w-full transition duration-300 hover:opacity-90"
        />
      </button>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="current"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
        @click.self="close"
      >
        <button class="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-2xl text-neutral-400 hover:text-white" @click="prev">‹</button>
        <button class="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-2xl text-neutral-400 hover:text-white" @click="next">›</button>
        <button class="absolute right-4 top-4 p-2 text-sm text-neutral-400 hover:text-white" @click="close">✕</button>

        <img
          :src="`/img/${current.sha}?w=1600`"
          :alt="current.filename"
          class="max-h-[88vh] max-w-[92vw] object-contain"
        />

        <a
          :href="`/img/${current.sha}?dl=1`"
          class="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-line bg-ink/80 px-4 py-2 text-xs text-neutral-200 backdrop-blur transition hover:border-neutral-500"
        >
          ↓ Original herunterladen
        </a>
      </div>
    </Teleport>
  </div>
</template>
