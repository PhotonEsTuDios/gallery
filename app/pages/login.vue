<script setup lang="ts">
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/login', { method: 'POST', body: { password: password.value } })
    await navigateTo('/')
  } catch {
    error.value = 'Falsches Passwort.'
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-6">
    <form class="w-full max-w-xs text-center" @submit.prevent="submit">
      <div class="mb-8">
        <div class="text-lg font-semibold tracking-tight">Photon<span class="text-neutral-500">·</span>EsTuDios</div>
        <div class="mt-1 text-xs uppercase tracking-[0.25em] text-neutral-500">Gallery</div>
      </div>

      <input
        v-model="password"
        type="password"
        placeholder="Passwort"
        autofocus
        class="w-full rounded-lg border border-line bg-ink-soft px-4 py-3 text-center text-sm outline-none transition focus:border-neutral-500"
      />

      <button
        type="submit"
        :disabled="loading"
        class="mt-3 w-full rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:opacity-50"
      >
        {{ loading ? '…' : 'Eintreten' }}
      </button>

      <p v-if="error" class="mt-3 text-xs text-red-400">{{ error }}</p>
    </form>
  </div>
</template>
