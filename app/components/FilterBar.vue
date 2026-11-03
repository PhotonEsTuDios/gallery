<script setup lang="ts">
// Gemeinsame Filterleiste (gallery#8): Personen (zusammen/oder), Farbe, Jahr, Herkunft.
// Alles steht in der URL (useFilter) und gilt für jede Ansicht.
const f = useFilter()
const { data: names } = useFetch<{ name: string; count: number }[]>('/api/personen/namen', { lazy: true, server: false, default: () => [] })
const { data: counts } = useFetch<Record<string, number>>('/api/herkunft', { lazy: true, server: false })

const more = ref(false)
const search = ref('')
const suggestions = computed(() => (names.value ?? []).filter((n) => !f.persons.value.includes(n.name)).slice(0, 6))
function addPerson() {
  const n = search.value.trim()
  const hit = (names.value ?? []).find((x) => x.name.toLowerCase() === n.toLowerCase())
  if (hit) f.toggle('p', hit.name)
  search.value = ''
}
const thisYear = new Date().getFullYear()
const years = Array.from({ length: thisYear - 1999 }, (_, i) => String(thisYear - i))
function addYear(e: Event) {
  const y = (e.target as HTMLSelectElement).value
  if (y) f.toggle('jahr', y)
  ;(e.target as HTMLSelectElement).value = ''
}
const chip = 'rounded-full border px-3 py-1 transition'
const on = 'border-neutral-300 text-neutral-100'
const off = 'border-line text-neutral-500 hover:text-neutral-200'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs" data-test="filterbar">
    <span class="uppercase tracking-[0.15em] text-neutral-500">Personen</span>

    <button v-for="p in f.persons.value" :key="p" :class="[chip, on]" :title="`${p} entfernen`" @click="f.toggle('p', p)">
      {{ p }} <span class="text-neutral-500">✕</span>
    </button>

    <div v-if="f.persons.value.length >= 2" class="flex overflow-hidden rounded-full border border-line" data-test="personmode">
      <button
        v-for="m in (['zusammen', 'oder'] as const)"
        :key="m"
        class="px-3 py-1 transition"
        :class="f.personMode.value === m ? 'bg-neutral-100 text-black' : 'text-neutral-400 hover:text-neutral-200'"
        :title="m === 'zusammen' ? 'alle auf demselben Foto' : 'mindestens eine Person'"
        @click="f.setPersonMode(m)"
      >
        {{ m }}
      </button>
    </div>

    <button v-for="s in suggestions" :key="s.name" :class="[chip, off]" @click="f.toggle('p', s.name)">
      + {{ s.name }}<span class="ml-1 text-neutral-600">{{ s.count }}</span>
    </button>
    <form v-if="(names?.length ?? 0) > suggestions.length" class="inline" @submit.prevent="addPerson">
      <input
        v-model="search"
        list="filter-names"
        placeholder="Person suchen…"
        class="w-32 rounded-full border border-line bg-transparent px-3 py-1 text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        @change="addPerson"
      />
      <datalist id="filter-names">
        <option v-for="n in names" :key="n.name" :value="n.name" />
      </datalist>
    </form>
    <NuxtLink v-if="!names?.length" to="/personen" class="text-neutral-500 underline-offset-2 hover:underline">
      noch niemand benannt → Personen
    </NuxtLink>

    <span class="mx-1 h-4 w-px bg-line" />

    <span v-for="y in f.years.value" :key="y">
      <button :class="[chip, on]" @click="f.toggle('jahr', y)">{{ y }} <span class="text-neutral-500">✕</span></button>
    </span>
    <span v-for="c in f.colors.value" :key="c">
      <button :class="[chip, on]" @click="f.toggle('farbe', c)">{{ c }} <span class="text-neutral-500">✕</span></button>
    </span>
    <span v-for="o in f.origins.value" :key="o">
      <button :class="[chip, on]" @click="f.toggle('herkunft', o)">
        {{ HERKUNFT_OPTIONEN.find((x) => x.id === o)?.label ?? o }} <span class="text-neutral-500">✕</span>
      </button>
    </span>

    <button :class="[chip, off]" data-test="filter-more" @click="more = !more">{{ more ? 'weniger' : 'Jahr · Farbe · Herkunft' }}</button>
    <button v-if="f.active.value" class="text-neutral-500 underline-offset-2 hover:text-neutral-200 hover:underline" @click="f.clear()">
      Filter löschen
    </button>

    <div v-if="more" class="flex w-full flex-wrap items-center gap-2 pt-1">
      <select class="rounded-full border border-line bg-ink px-3 py-1 text-neutral-300" @change="addYear">
        <option value="">Jahr…</option>
        <option v-for="y in years" :key="y" :value="y" :disabled="f.years.value.includes(y)">{{ y }}</option>
      </select>
      <button
        v-for="c in FARBEN"
        :key="c.id"
        class="h-5 w-5 rounded-full border transition"
        :class="f.colors.value.includes(c.id) ? 'border-white ring-2 ring-white/60' : 'border-line hover:border-neutral-400'"
        :style="{ background: c.hex }"
        :title="c.id"
        @click="f.toggle('farbe', c.id)"
      />
      <span class="mx-1 h-4 w-px bg-line" />
      <button
        v-for="o in HERKUNFT_OPTIONEN"
        :key="o.id"
        :class="[chip, f.origins.value.includes(o.id) ? on : off]"
        :disabled="counts && !counts[o.id]"
        @click="f.toggle('herkunft', o.id)"
      >
        {{ o.label }}<span v-if="counts" class="ml-1 text-neutral-500">{{ counts[o.id] ?? 0 }}</span>
      </button>
    </div>
  </div>
</template>
