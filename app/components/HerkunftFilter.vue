<script setup lang="ts">
const { selected, toggle, clear } = useHerkunft()
const { data: counts } = useFetch<Record<string, number>>('/api/herkunft', { lazy: true, server: false })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs">
    <span class="uppercase tracking-[0.15em] text-neutral-500">Herkunft</span>
    <button
      class="rounded-full border px-3 py-1 transition"
      :class="selected.length === 0 ? 'border-neutral-300 text-neutral-100' : 'border-line text-neutral-500 hover:text-neutral-200'"
      @click="clear"
    >
      Alle<span v-if="counts" class="ml-1 text-neutral-500">{{ counts.total }}</span>
    </button>
    <button
      v-for="o in HERKUNFT_OPTIONEN"
      :key="o.id"
      class="rounded-full border px-3 py-1 transition"
      :class="selected.includes(o.id) ? 'border-neutral-300 text-neutral-100' : 'border-line text-neutral-500 hover:text-neutral-200'"
      :disabled="counts && !counts[o.id]"
      :title="counts && !counts[o.id] ? 'noch keine Fotos aus dieser Quelle' : ''"
      @click="toggle(o.id)"
    >
      {{ o.label }}<span v-if="counts" class="ml-1 text-neutral-500">{{ counts[o.id] ?? 0 }}</span>
    </button>
  </div>
</template>
