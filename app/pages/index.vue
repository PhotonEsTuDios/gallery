<script setup lang="ts">
interface Album {
  name: string
  count: number
  cover: string
  latest: string
}

// lazy = Seite öffnet sofort, Liste lädt im Hintergrund (Navigation bleibt frei)
const { query } = useHerkunft()
const { data: albums, pending } = useFetch<Album[]>('/api/albums', { lazy: true, query })
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <h1 class="mb-6 text-sm uppercase tracking-[0.2em] text-neutral-500">Alben</h1>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="!albums?.length" class="text-sm text-neutral-500">Noch keine Fotos.</p>

    <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <NuxtLink
        v-for="a in albums"
        :key="a.name"
        :to="`/album/${encodeURIComponent(a.name)}`"
        class="group relative aspect-square overflow-hidden rounded-xl border border-line"
      >
        <img
          :src="`/img/${a.cover}?w=400`"
          :alt="a.name"
          loading="lazy"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
        <div class="absolute bottom-0 left-0 right-0 p-3">
          <div class="truncate text-sm font-medium">{{ a.name }}</div>
          <div class="text-xs text-neutral-400">{{ a.count }} Fotos</div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
