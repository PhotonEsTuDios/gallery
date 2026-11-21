<script setup lang="ts">
// Live-Stand der Raw-Importe (z.B. Time-Machine-Backup) — liest progress.json,
// das der Import-Treiber nach jedem Batch nach S3 schreibt. Darunter die Läufe der Erkennung (gallery#21).
interface Progress {
  name: string
  state: string
  source?: string
  updated_at?: string
  started_at?: string
  total_files?: number
  done_files?: number
  total_bytes?: number
  done_bytes?: number
  percent?: number
  counts?: { new: number; dup: number; skip: number; err: number }
  rate_mb_s?: number
  eta_h?: number | null
  current?: string
  batches?: number
  last_errors?: { key: string; error: string }[]
}

const { data, refresh } = useFetch<Progress[]>('/api/import', { server: false })

// Läufe der Tier- und Gesichtserkennung (gallery#21): Fortschritts-Einträge aus staubsauger
interface Run {
  key: string
  label: string
  found_label: string
  state: string
  done: number
  total: number
  found: number
  err: number
  packages_done: number
  packages: number
  percent: number
  planned_at: string | null
  updated_at: string | null
}
const { data: runs, refresh: refreshRuns } = useFetch<Run[]>('/api/erkennung', { server: false })
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–')

let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(() => { refresh(); refreshRuns() }, 15000)))
onBeforeUnmount(() => timer && clearInterval(timer))

const gb = (b?: number) => ((b ?? 0) / 1e9).toFixed(1)
const fmt = (n?: number) => (n ?? 0).toLocaleString('de-DE')
function ago(iso?: string | null) {
  if (!iso) return ''
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000)
  if (s < 90) return `vor ${s} s`
  if (s < 5400) return `vor ${Math.round(s / 60)} min`
  return s < 172800 ? `vor ${Math.round(s / 3600)} h` : `vor ${Math.round(s / 86400)} Tagen`
}
function eta(h?: number | null) {
  if (h == null) return '–'
  const m = Math.round(h * 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-5 py-8">
    <h1 class="mb-6 text-sm uppercase tracking-[0.2em] text-neutral-500">Import</h1>
    <p v-if="!data" class="text-sm text-neutral-500">Lade…</p>

    <section v-for="p in data" :key="p.name" class="mb-8 rounded-xl border border-line p-5">
      <div class="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <div class="text-sm font-medium">{{ p.name }}</div>
          <div class="text-xs text-neutral-500">Quelle {{ p.source || '–' }}</div>
        </div>
        <div
          class="rounded-full border px-3 py-1 text-xs"
          :class="p.state === 'fertig' ? 'border-emerald-700 text-emerald-400' : p.state === 'läuft' ? 'border-sky-700 text-sky-300' : 'border-line text-neutral-400'"
        >
          {{ p.state }}
        </div>
      </div>

      <template v-if="p.total_files">
        <div class="mb-1 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div class="h-full bg-sky-500 transition-all" :style="{ width: `${p.percent ?? 0}%` }" />
        </div>
        <div class="mb-4 flex justify-between text-xs text-neutral-400">
          <span>{{ p.percent }} % · {{ gb(p.done_bytes) }} / {{ gb(p.total_bytes) }} GB</span>
          <span>{{ fmt(p.done_files) }} / {{ fmt(p.total_files) }} Dateien</span>
        </div>

        <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div><dt class="text-xs text-neutral-500">neu (dieser Lauf)</dt><dd>{{ fmt(p.counts?.new) }}</dd></div>
          <div><dt class="text-xs text-neutral-500">schon vorhanden</dt><dd>{{ fmt(p.counts?.dup) }}</dd></div>
          <div><dt class="text-xs text-neutral-500">übersprungen</dt><dd>{{ fmt(p.counts?.skip) }}</dd></div>
          <div><dt class="text-xs text-neutral-500">Fehler</dt><dd :class="p.counts?.err ? 'text-rose-400' : ''">{{ fmt(p.counts?.err) }}</dd></div>
          <div><dt class="text-xs text-neutral-500">Tempo</dt><dd>{{ p.rate_mb_s }} MB/s</dd></div>
          <div><dt class="text-xs text-neutral-500">Restzeit</dt><dd>{{ p.state === 'fertig' ? '–' : eta(p.eta_h) }}</dd></div>
          <div><dt class="text-xs text-neutral-500">Pakete fertig</dt><dd>{{ p.batches }}</dd></div>
          <div><dt class="text-xs text-neutral-500">aktualisiert</dt><dd>{{ ago(p.updated_at) }}</dd></div>
        </dl>
        <p v-if="p.current" class="mt-3 text-xs text-neutral-500">{{ p.current }}</p>

        <details v-if="p.last_errors?.length" class="mt-4 text-xs">
          <summary class="cursor-pointer text-rose-400">Letzte Fehler ({{ p.last_errors.length }})</summary>
          <ul class="mt-2 space-y-1 text-neutral-400">
            <li v-for="e in p.last_errors" :key="e.key" class="break-all">{{ e.key.replace(/^raw\/[^/]+\//, '') }} — {{ e.error }}</li>
          </ul>
        </details>
      </template>
    </section>

    <!-- Erkennung (gallery#21) -->
    <template v-if="runs?.length">
      <h2 class="mb-4 mt-10 text-sm uppercase tracking-[0.2em] text-neutral-500">Erkennung</h2>
      <section v-for="r in runs" :key="r.key" class="mb-8 rounded-xl border border-line p-5" :data-test="`run-${r.key}`">
        <div class="mb-3 flex items-baseline justify-between gap-4">
          <div>
            <div class="text-sm font-medium">{{ r.label }}</div>
            <div class="text-xs text-neutral-500">letzter Lauf geplant {{ day(r.planned_at) }}</div>
          </div>
          <div
            class="rounded-full border px-3 py-1 text-xs"
            :class="r.state === 'fertig' ? 'border-emerald-700 text-emerald-400' : r.state === 'läuft' ? 'border-sky-700 text-sky-300' : 'border-line text-neutral-400'"
            data-test="run-state"
          >
            {{ r.state }}
          </div>
        </div>

        <template v-if="r.total">
          <div class="mb-1 h-2 overflow-hidden rounded-full bg-neutral-800">
            <div class="h-full transition-all" :class="r.state === 'fertig' ? 'bg-emerald-500' : 'bg-sky-500'" :style="{ width: `${r.percent}%` }" data-test="run-bar" />
          </div>
          <div class="mb-4 flex justify-between text-xs text-neutral-400">
            <span>{{ r.percent.toLocaleString('de-DE') }} %</span>
            <span data-test="run-count">{{ fmt(r.done) }} / {{ fmt(r.total) }} Fotos</span>
          </div>
          <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt class="text-xs text-neutral-500">{{ r.found_label }}</dt><dd>{{ fmt(r.found) }}</dd></div>
            <div><dt class="text-xs text-neutral-500">Fehler</dt><dd :class="r.err ? 'text-rose-400' : ''">{{ fmt(r.err) }}</dd></div>
            <div><dt class="text-xs text-neutral-500">Pakete fertig</dt><dd>{{ fmt(r.packages_done) }} / {{ fmt(r.packages) }}</dd></div>
            <div><dt class="text-xs text-neutral-500">aktualisiert</dt><dd>{{ ago(r.updated_at) }}</dd></div>
          </dl>
        </template>
        <p v-else-if="r.state === 'fertig'" class="text-xs text-neutral-500" data-test="run-count">
          Im letzten Lauf gab es keine neuen Fotos zu prüfen (0 / 0) · aktualisiert {{ ago(r.updated_at) }}
        </p>
        <p v-else class="text-xs text-neutral-500">Noch kein Lauf geplant.</p>
      </section>
    </template>
  </div>
</template>
