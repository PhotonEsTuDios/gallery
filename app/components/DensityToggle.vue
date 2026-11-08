<script setup lang="ts">
// Knöpfe XS…XL + Tasten +/− (gallery#13/#14). Eine Instanz je Seite einbauen.
import { DENSITIES, DENSITY_TITLE } from '~/composables/useDensity'

const props = defineProps<{ bare?: boolean }>() // bare = ohne eigenen Rahmen (in einer Leiste)
const { density, set, step } = useDensity()
const lightboxOpen = useLightboxOpen()

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || lightboxOpen.value) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
  if (e.key === '+' || e.key === '=') step(1)
  else if (e.key === '-' || e.key === '_') step(-1)
  else return
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex items-center gap-1" :class="props.bare ? '' : 'rounded-full border border-line p-0.5'" data-test="density">
    <button
      v-for="d in DENSITIES"
      :key="d"
      :data-test="`density-${d}`"
      class="h-7 w-8 rounded-full text-xs transition"
      :class="density === d ? 'bg-neutral-200 text-black' : 'text-neutral-400 hover:text-neutral-200'"
      :title="`${DENSITY_TITLE[d]} (Tasten + / −)`"
      @click="set(d)"
    >
      {{ d }}
    </button>
  </div>
</template>
