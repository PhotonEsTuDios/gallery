<script setup lang="ts">
import 'leaflet/dist/leaflet.css'

interface MapPin {
  sha: string
  filename: string
  lat: number
  lon: number
}
interface MapData {
  count: number
  pins: MapPin[]
}

const { data } = useFetch<MapData>('/api/map', { lazy: true })

const mapEl = ref<HTMLElement | null>(null)
let map: any = null
let added = false

onMounted(async () => {
  const L = (await import('leaflet')).default
  map = L.map(mapEl.value!, { worldCopyJump: true }).setView([36.888, -3.41], 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  // Pins setzen, sobald die Daten da sind (einmalig)
  watchEffect(() => {
    if (added || !map || !data.value?.pins?.length) return
    const pts: [number, number][] = []
    for (const p of data.value.pins) {
      const m = L.circleMarker([p.lat, p.lon], {
        radius: 6, color: '#fff', weight: 1, fillColor: '#e67e22', fillOpacity: 0.9,
      }).addTo(map)
      m.bindPopup(
        `<a href="/img/${p.sha}?dl=1" target="_blank" rel="noopener">` +
        `<img src="/img/${p.sha}?w=200" style="width:160px;display:block;border-radius:6px"/></a>` +
        `<div style="font-size:11px;margin-top:4px;color:#333">${p.filename}</div>`,
      )
      pts.push([p.lat, p.lon])
    }
    map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 })
    added = true
  })
})
onUnmounted(() => map?.remove())
</script>

<template>
  <div class="mx-auto max-w-7xl px-5 py-8">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-sm uppercase tracking-[0.2em] text-neutral-500">Karte</h1>
      <span v-if="data" class="text-xs text-neutral-500">{{ data.count.toLocaleString('de-DE') }} verortet</span>
    </div>
    <p v-if="data && !data.count" class="mb-3 text-sm text-neutral-500">
      Noch keine verorteten Fotos — der GPS-Lauf hat erst einen Teil des Archivs geprüft.
    </p>
    <div
      ref="mapEl"
      class="h-[72vh] w-full overflow-hidden rounded-xl border border-line"
      style="background: #0a0a0a"
    />
  </div>
</template>
