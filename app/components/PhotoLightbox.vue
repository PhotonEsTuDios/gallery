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

function onKey(e: KeyboardEvent) {
  if (props.index === null) return
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

      <!-- Bild -->
      <img
        v-else
        :src="`/img/${current.sha}?w=1600`"
        :alt="current.filename"
        class="max-h-[88vh] max-w-[92vw] object-contain"
      />

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
