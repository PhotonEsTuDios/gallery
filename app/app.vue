<script setup lang="ts">
const route = useRoute()
const showChrome = computed(() => route.path !== '/login')

async function logout() {
  await $fetch('/api/logout', { method: 'POST' })
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header
      v-if="showChrome"
      class="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/80 px-5 py-3 backdrop-blur"
    >
      <NuxtLink to="/" class="flex items-baseline gap-2">
        <span class="text-sm font-semibold tracking-tight">Photon<span class="text-neutral-500">·</span>EsTuDios</span>
        <span class="text-xs uppercase tracking-[0.2em] text-neutral-500">Gallery</span>
      </NuxtLink>
      <button
        class="rounded-full border border-line px-3 py-1 text-xs text-neutral-400 transition hover:border-neutral-600 hover:text-neutral-200"
        @click="logout"
      >
        Abmelden
      </button>
    </header>

    <main class="flex-1">
      <NuxtPage />
    </main>
  </div>
</template>
