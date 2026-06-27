<script setup lang="ts">
interface Photo {
  sha: string
  filename: string
  bytes: number
  uploaded_at: string
  taken_at: string | null
  kind: 'photo' | 'video'
}
interface AlbumData {
  name: string
  count: number
  photos: Photo[]
}

const route = useRoute()
const name = computed(() => route.params.name as string)
const { data: album, pending, error } = useFetch<AlbumData>(() => `/api/album/${name.value}`, { lazy: true })

// Foto/Video-Filter
type Kind = 'all' | 'photo' | 'video'
const filter = ref<Kind>('all')
const nVideos = computed(() => album.value?.photos.filter((p) => p.kind === 'video').length ?? 0)
const shown = computed<Photo[]>(() =>
  (album.value?.photos ?? []).filter((p) => filter.value === 'all' || p.kind === filter.value),
)

// Lightbox (über die gefilterte Liste)
const openIndex = ref<number | null>(null)
function open(i: number) {
  openIndex.value = i
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <NuxtLink to="/" class="text-neutral-500 transition hover:text-neutral-200">←</NuxtLink>
      <h1 class="text-sm font-medium">{{ album?.name || name }}</h1>
      <span v-if="album" class="text-xs text-neutral-500">{{ album.count }} Medien</span>
      <!-- Filter nur zeigen, wenn das Album überhaupt Videos hat -->
      <div v-if="nVideos" class="ml-auto flex gap-1 rounded-full border border-line p-0.5 text-xs">
        <button
          v-for="f in (['all', 'photo', 'video'] as const)"
          :key="f"
          class="rounded-full px-3 py-1 transition"
          :class="filter === f ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
          @click="filter = f"
        >
          {{ f === 'all' ? 'Alle' : f === 'photo' ? 'Fotos' : `Videos (${nVideos})` }}
        </button>
      </div>
    </div>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="error" class="text-sm text-red-400">Album nicht gefunden.</p>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <button
        v-for="(p, i) in shown"
        :key="p.sha"
        class="group relative aspect-square overflow-hidden rounded-lg border border-line bg-ink-soft"
        @click="open(i)"
      >
        <VideoTile v-if="p.kind === 'video'" :sha="p.sha" :filename="p.filename" />
        <img
          v-else
          :src="`/img/${p.sha}?w=400`"
          :alt="p.filename"
          loading="lazy"
          class="h-full w-full object-cover transition duration-300 group-hover:opacity-90"
        />
      </button>
    </div>

    <PhotoLightbox v-if="album" :photos="shown" v-model:index="openIndex" />
  </div>
</template>
