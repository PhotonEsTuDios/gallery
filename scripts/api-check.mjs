// Wachstums-Test der Gallery-API (infra#13): Das Archiv wächst, die Lambda hat harte Grenzen.
//  - 6 MB Antwort-Limit (Function URL) -> jede API-Antwort muss deutlich darunter bleiben
//  - Speicher + 30 s Timeout -> Lambda-Logs auf OutOfMemory/413/Timeout und Auslastung prüfen
// Warnt ab 70 % eines Limits, damit wir rechtzeitig umbauen und nicht erst beim 502.
// Usage: set -a; . ./.env; set +a; AWS_PROFILE=photon-new [BASE=https://…] node scripts/api-check.mjs
// (.env setzt noch das alte Profil 'photon' -> für die Lambda-Logs AWS_PROFILE danach überschreiben)
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const PW = process.env.GALLERY_PASSWORD
const FN = process.env.FUNCTION_NAME || 'photon-gallery'
const REGION = process.env.AWS_REGION || 'eu-west-1'
const PAYLOAD_LIMIT = 6 * 1024 * 1024
const WARN = 0.7
// gallery#2: Ziel ist max. 50 % vom Limit, auch bei doppelter Archivgröße.
// Seitenweise Routen wachsen nur in der Seitenzahl; ungeteilte Antworten (Indizes) werden ×2 geschätzt.
const TARGET = 0.5
if (!PW) { console.error('GALLERY_PASSWORD fehlt'); process.exit(1) }

let fail = 0, warn = 0
const ok = (name, cond, info = '') => { console.log(`${cond ? '✓' : '✗'} ${name} ${info}`); if (!cond) fail++ }
const note = (name, info) => { console.log(`⚠ ${name} ${info}`); warn++ }
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB'
const t0 = Date.now()
let maxShare = 0 // größter Anteil einer einzelnen Antwort am 6-MB-Limit

const b = await chromium.launch()
const ctx = await b.newContext()
const p = await ctx.newPage()
await p.goto(BASE + '/login', { waitUntil: 'networkidle' })
await p.fill('input[type=password]', PW)
await p.click('button[type=submit]')
await p.waitForURL(BASE + '/', { timeout: 20000 }).catch(() => {})
ok('Login', p.url() === BASE + '/', p.url())

// Eine API-Route holen: Status, Größe (gegen 6 MB), Dauer (gegen 30 s)
async function api(path) {
  const s = Date.now()
  const r = await ctx.request.get(BASE + path, { timeout: 60000 }).catch((e) => null)
  const ms = Date.now() - s
  if (!r) { ok(path, false, 'keine Antwort'); return null }
  const body = await r.body()
  const size = body.length
  const good = r.status() === 200
  ok(path, good, `HTTP ${r.status()} · ${mb(size)} · ${(ms / 1000).toFixed(1)} s`)
  if (good && size > PAYLOAD_LIMIT * WARN) note(`${path} nah am 6-MB-Limit`, `(${Math.round((100 * size) / PAYLOAD_LIMIT)} %) → paginieren/kürzen`)
  maxShare = Math.max(maxShare, size / PAYLOAD_LIMIT)
  if (ms > 30000 * WARN) note(`${path} langsam`, `${(ms / 1000).toFixed(1)} s von 30 s`)
  try { return good ? JSON.parse(body.toString('utf8')) : null } catch { return null }
}

// Seitenweise Route komplett durchgehen: jede Seite prüfen, Summe muss total ergeben
async function paged(path, listKey, totalKey = 'total') {
  let offset = 0, n = 0, total = null, pages = 0
  while (offset !== null) {
    const d = await api(offset ? `${path}${path.includes('?') ? '&' : '?'}offset=${offset}` : path)
    if (!d) return null
    total = d[totalKey]; n += d[listKey].length; pages++; offset = d.next
    if (pages > 200) { ok(`${path} Seiten`, false, 'mehr als 200 Seiten?'); return null }
  }
  ok(`${path} vollständig`, n === total, `${n} = ${total} in ${pages} Seite(n)`)
  return { n, total, pages }
}

// Ungeteilte Antworten (wachsen mit dem Archiv): bei doppelter Größe noch unter 50 %?
async function grows(path) {
  const s = Date.now()
  const r = await ctx.request.get(BASE + path, { timeout: 60000 }).catch(() => null)
  const size = r ? (await r.body()).length : 0
  if (size * 2 > PAYLOAD_LIMIT * TARGET) note(`${path} bei doppeltem Archiv`, `≈ ${Math.round((200 * size) / PAYLOAD_LIMIT)} % vom Limit (Ziel ≤ 50 %)`)
}

const albums = await api('/api/albums')
const months = await api('/api/timeline')
for (const path of ['/api/me', '/api/herkunft', '/api/labels', '/api/portfolio', '/api/import']) await api(path)
for (const path of ['/api/albums', '/api/timeline', '/api/labels', '/api/import']) await grows(path)
await paged('/api/nikon', 'r')
await paged('/api/map', 'pins', 'count')
// Herkunfts-Filter (eigene, ungecachte Antworten)
for (const h of ['dropbox', 'timemachine']) await api(`/api/albums?herkunft=${h}`)

// Die größten Einheiten sind die Engstellen: größtes Album, größter Monat
if (Array.isArray(albums) && albums.length) {
  const big = [...albums].sort((a, b) => b.count - a.count)[0]
  console.log(`  größtes Album: ${big.name} (${big.count} Bilder)`)
  const a = await paged('/api/album/' + encodeURIComponent(big.name), 'photos', 'count')
  ok('größtes Album = Albenliste', a?.total === big.count, `${a?.total} = ${big.count}`)
} else ok('Albenliste', false)
if (Array.isArray(months) && months.length) {
  const big = [...months].sort((a, b) => b.count - a.count)[0]
  console.log(`  größter Monat: ${big.ym} (${big.count} Bilder)`)
  const m = await paged('/api/timeline/' + big.ym, 'items')
  ok('größter Monat = Timeline-Index', m?.total === big.count, `${m?.total} = ${big.count}`)
} else ok('Timeline-Index', false)

// Ein Bild und ein Thumbnail wirklich ausliefern
if (Array.isArray(albums) && albums[0]) {
  const r = await ctx.request.get(`${BASE}/img/${albums[0].cover}?w=400`)
  ok('Thumbnail', r.status() === 200 && (await r.body()).length > 1000, `HTTP ${r.status()}`)
}
await b.close()

// Lambda-Logs seit Teststart: harte Fehler + Auslastung
if (process.env.AWS_PROFILE) try {
  const aws = (...a) => execFileSync('aws', [...a, '--region', REGION, '--output', 'json'], { encoding: 'utf8' })
  const conf = JSON.parse(aws('lambda', 'get-function-configuration', '--function-name', FN))
  await new Promise((r) => setTimeout(r, 15000)) // Logs brauchen ein paar Sekunden
  const ev = JSON.parse(aws('logs', 'filter-log-events', '--log-group-name', `/aws/lambda/${FN}`,
    '--start-time', String(t0 - 30 * 1000), '--filter-pattern', '?REPORT ?OutOfMemory ?RequestEntityTooLarge ?"Task timed out"')).events || []
  const msgs = ev.map((e) => e.message)
  const bad = msgs.filter((m) => /OutOfMemory|RequestEntityTooLarge|Task timed out/.test(m))
  ok('Lambda: kein OutOfMemory/413/Timeout', bad.length === 0, bad.slice(0, 2).map((m) => m.slice(0, 120)).join(' | '))
  const mem = Math.max(0, ...msgs.map((m) => Number((m.match(/Max Memory Used: (\d+)/) || [])[1] || 0)))
  const dur = Math.max(0, ...msgs.map((m) => Number((m.match(/\tDuration: ([\d.]+)/) || [])[1] || 0)))
  ok('Lambda-Speicher', mem < conf.MemorySize, `max ${mem} von ${conf.MemorySize} MB`)
  if (mem > conf.MemorySize * WARN) note('Speicher knapp', `${Math.round((100 * mem) / conf.MemorySize)} % → Index verschlanken oder Speicher erhöhen`)
  ok('Lambda-Dauer', dur < conf.Timeout * 1000, `max ${(dur / 1000).toFixed(1)} von ${conf.Timeout} s`)
  if (dur > conf.Timeout * 1000 * WARN) note('Dauer knapp', `${(dur / 1000).toFixed(1)} s von ${conf.Timeout} s`)
} catch (e) { note('Lambda-Logs nicht lesbar', `(${String(e.stderr || e.message).trim().split('\n').pop().slice(0, 140)}) → AWS_PROFILE=photon-new setzen`) }
else console.log('  (Lambda-Logs übersprungen: AWS_PROFILE nicht gesetzt)')

console.log(`  größte Einzelantwort: ${Math.round(maxShare * 100)} % vom 6-MB-Limit (Ziel ≤ ${TARGET * 100} %)`)
ok('Ziel ≤ 50 % je Antwort', maxShare <= TARGET)
console.log(fail ? `✗ ${fail} Fehler, ${warn} Warnungen` : warn ? `✅ grün mit ${warn} Warnungen` : '✅ alles grün')
process.exit(fail ? 1 : 0)
