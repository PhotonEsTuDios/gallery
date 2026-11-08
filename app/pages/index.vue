<script setup lang="ts">
interface Album {
  name: string
  count: number
  cover: string
  latest: string
  date: string
  year: number
  saved?: boolean
  person?: string
}

// lazy = Seite öffnet sofort, Liste lädt im Hintergrund (Navigation bleibt frei)
const { query, to } = useFilter()
const { data: albums, pending } = useFetch<Album[]>('/api/albums', { lazy: true, query })

// Nach Jahr gruppiert (staubsauger#8): statt 18 Jahres-Klumpen gibt es jetzt ~1.500
// Session-Alben, die werden pro Jahr mit Überschrift gezeigt. Die Liste kommt bereits
// sortiert (jüngstes zuerst), also nur zusammenfassen.
const years = computed(() => {
  const out: { year: number; label: string; albums: Album[]; photos: number }[] = []
  for (const a of (albums.value ?? []).filter((x) => !x.saved)) {
    const last = out[out.length - 1]
    if (last && last.year === a.year) { last.albums.push(a); last.photos += a.count }
    else out.push({ year: a.year, label: a.year ? String(a.year) : 'Ohne Datum', albums: [a], photos: a.count })
  }
  return out
})
const mine = computed(() => (albums.value ?? []).filter((a) => a.saved)) // gallery#15
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <h1 class="mb-6 text-sm uppercase tracking-[0.2em] text-neutral-500">Alben</h1>

    <p v-if="pending" class="text-sm text-neutral-500">Lade…</p>
    <p v-else-if="!albums?.length" class="text-sm text-neutral-500">Noch keine Fotos.</p>

    <template v-else>
    <!-- Meine Alben (gespeichert, gallery#15) -->
    <section v-if="mine.length" class="mb-10" data-test="mine">
      <h2 class="mb-3 flex items-baseline gap-3 border-b border-line pb-2">
        <span class="text-lg font-medium">Meine Alben</span>
        <span class="text-xs text-neutral-500">{{ mine.length }}</span>
      </h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <NuxtLink
          v-for="a in mine"
          :key="a.name"
          :to="to(`/album/${encodeURIComponent(a.name)}`)"
          class="group relative aspect-square overflow-hidden rounded-xl border border-line"
        >
          <img :src="`/img/${a.cover}?w=400`" :alt="a.name" loading="lazy" class="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
          <div class="absolute bottom-0 left-0 right-0 p-3">
            <div class="truncate text-sm font-medium">{{ a.name }}</div>
            <div class="text-xs text-neutral-400">{{ a.count }} Fotos</div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section v-for="y in years" :key="y.year" class="mb-10">
      <h2 class="mb-3 flex items-baseline gap-3 border-b border-line pb-2">
        <span class="text-lg font-medium">{{ y.label }}</span>
        <span class="text-xs text-neutral-500">{{ y.albums.length }} Alben · {{ y.photos }} Medien</span>
      </h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <NuxtLink
          v-for="a in y.albums"
          :key="a.name"
          :to="to(`/album/${encodeURIComponent(a.name)}`)"
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
    </section>
    </template>
  </div>
</template>
