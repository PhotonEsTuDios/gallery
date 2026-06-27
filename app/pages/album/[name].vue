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
// lazy = blockiert die Navigation NICHT (Zurück geht auch während des Ladens)
const { data: album, pending, error } = useFetch<AlbumData>(() => `/api/album/${name.value}`, { lazy: true })

// Lightbox (Komponente PhotoLightbox steuert Tasten/Navigation)
const openIndex = ref<number | null>(null)
function open(i: number) {
  openIndex.value = i
}
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

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <button
        v-for="(p, i) in album?.photos"
        :key="p.sha"
        class="group relative aspect-square overflow-hidden rounded-lg border border-line bg-ink-soft"
        @click="open(i)"
      >
        <img
          :src="`/img/${p.sha}?w=400`"
          :alt="p.filename"
          loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:opacity-90"
        />
      </button>
    </div>

    <PhotoLightbox v-if="album" :photos="album.photos" v-model:index="openIndex" />
  </div>
</template>
