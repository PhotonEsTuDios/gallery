<script setup lang="ts">
const route = useRoute()
// Keine Galerie-Navigation auf Login und auf privaten Künstler-Shares
const showChrome = computed(() => route.path !== '/login' && !route.path.startsWith('/s/'))

const authed = useState('authed', () => false)
async function logout() {
  await postSigned('/api/logout')
  authed.value = false
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header
      v-if="showChrome"
      class="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/80 px-5 py-3 backdrop-blur"
    >
      <div class="flex items-baseline gap-6">
        <NuxtLink to="/" class="flex items-baseline gap-2">
          <span class="text-sm font-semibold tracking-tight">Photon<span class="text-neutral-500">·</span>EsTuDios</span>
          <span class="text-xs uppercase tracking-[0.2em] text-neutral-500">Gallery</span>
        </NuxtLink>
        <nav class="flex items-center gap-4 text-xs uppercase tracking-[0.15em]">
          <NuxtLink
            to="/"
            class="transition hover:text-neutral-200"
            :class="route.path === '/' ? 'text-neutral-200' : 'text-neutral-500'"
          >
            Alben
          </NuxtLink>
          <NuxtLink
            to="/timeline"
            class="transition hover:text-neutral-200"
            :class="route.path === '/timeline' ? 'text-neutral-200' : 'text-neutral-500'"
          >
            Timeline
          </NuxtLink>
          <NuxtLink
            to="/labels"
            class="transition hover:text-neutral-200"
            :class="route.path === '/labels' ? 'text-neutral-200' : 'text-neutral-500'"
          >
            Labels
          </NuxtLink>
          <NuxtLink
            to="/map"
            class="transition hover:text-neutral-200"
            :class="route.path === '/map' ? 'text-neutral-200' : 'text-neutral-500'"
          >
            Karte
          </NuxtLink>
          <NuxtLink
            to="/auswahl"
            class="transition hover:text-neutral-200"
            :class="route.path === '/auswahl' ? 'text-neutral-200' : 'text-neutral-500'"
          >
            Auswahl
          </NuxtLink>
        </nav>
      </div>
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
