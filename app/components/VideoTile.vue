<script setup lang="ts">
defineProps<{ sha: string; filename: string }>()
const failed = ref(false)
</script>

<template>
  <div class="relative h-full w-full bg-neutral-900">
    <!-- Poster (falls vorhanden) -->
    <img
      v-if="!failed"
      :src="`/poster/${sha}`"
      :alt="filename"
      loading="lazy"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <!-- Fallback-Platzhalter, solange kein Poster da ist -->
    <div
      v-else
      class="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-center"
    >
      <span class="text-2xl text-neutral-300">▶</span>
      <span class="line-clamp-2 text-[9px] leading-tight text-neutral-500">{{ filename }}</span>
    </div>
    <!-- Play-Overlay, wenn ein Poster zu sehen ist -->
    <span v-if="!failed" class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-sm text-white backdrop-blur">▶</span>
    </span>
  </div>
</template>
