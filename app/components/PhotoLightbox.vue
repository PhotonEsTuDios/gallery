<script setup lang="ts">
interface Photo {
  sha: string
  filename: string
}

const props = defineProps<{
  photos: Photo[]
  index: number | null
}>()
const emit = defineEmits<{ 'update:index': [number | null] }>()

const current = computed(() => (props.index === null ? null : props.photos[props.index] ?? null))

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

function onKey(e: KeyboardEvent) {
  if (props.index === null) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}
onMounted(() => window.addEventListener('keydown', onKey))
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
</template>
