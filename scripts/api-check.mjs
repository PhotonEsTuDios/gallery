// Wachstums-Test der Gallery-API (infra#13): Das Archiv wächst, die Lambda hat harte Grenzen.
//  - 6 MB Antwort-Limit (Function URL) -> jede API-Antwort muss deutlich darunter bleiben
//  - Speicher + 30 s Timeout -> Lambda-Logs auf OutOfMemory/413/Timeout und Auslastung prüfen
// Warnt ab 70 % eines Limits, damit wir rechtzeitig umbauen und nicht erst beim 502.
// Usage: set -a; . ./.env; set +a; [BASE=https://…] [AWS_PROFILE=photon-new] node scripts/api-check.mjs
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const PW = process.env.GALLERY_PASSWORD
const FN = process.env.FUNCTION_NAME || 'photon-gallery'
const REGION = process.env.AWS_REGION || 'eu-west-1'
const PAYLOAD_LIMIT = 6 * 1024 * 1024
const WARN = 0.7
if (!PW) { console.error('GALLERY_PASSWORD fehlt'); process.exit(1) }

let fail = 0, warn = 0
const ok = (name, cond, info = '') => { console.log(`${cond ? '✓' : '✗'} ${name} ${info}`); if (!cond) fail++ }
const note = (name, info) => { console.log(`⚠ ${name} ${info}`); warn++ }
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB'
const t0 = Date.now()

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
  if (ms > 30000 * WARN) note(`${path} langsam`, `${(ms / 1000).toFixed(1)} s von 30 s`)
  try { return good ? JSON.parse(body.toString('utf8')) : null } catch { return null }
}

const albums = await api('/api/albums')
const months = await api('/api/timeline')
for (const path of ['/api/me', '/api/herkunft', '/api/labels', '/api/map', '/api/nikon', '/api/portfolio', '/api/import']) await api(path)
// Herkunfts-Filter (eigene, ungecachte Antworten)
for (const h of ['dropbox', 'timemachine']) await api(`/api/albums?herkunft=${h}`)

// Die größten Einheiten sind die Engstellen: größtes Album, größter Monat
if (Array.isArray(albums) && albums.length) {
  const big = [...albums].sort((a, b) => b.count - a.count)[0]
  console.log(`  größtes Album: ${big.name} (${big.count} Bilder)`)
  const a = await api('/api/album/' + encodeURIComponent(big.name))
  ok('größtes Album vollständig', a?.count === big.count, `${a?.count} = ${big.count}`)
} else ok('Albenliste', false)
if (Array.isArray(months) && months.length) {
  const big = [...months].sort((a, b) => b.count - a.count)[0]
  console.log(`  größter Monat: ${big.ym} (${big.count} Bilder)`)
  await api('/api/timeline/' + big.ym)
} else ok('Timeline-Index', false)

// Ein Bild und ein Thumbnail wirklich ausliefern
if (Array.isArray(albums) && albums[0]) {
  const r = await ctx.request.get(`${BASE}/img/${albums[0].cover}?w=400`)
  ok('Thumbnail', r.status() === 200 && (await r.body()).length > 1000, `HTTP ${r.status()}`)
}
await b.close()

// Lambda-Logs seit Teststart: harte Fehler + Auslastung
if (process.env.AWS_PROFILE) {
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
} else console.log('  (Lambda-Logs übersprungen: AWS_PROFILE nicht gesetzt)')

console.log(fail ? `✗ ${fail} Fehler, ${warn} Warnungen` : warn ? `✅ grün mit ${warn} Warnungen` : '✅ alles grün')
process.exit(fail ? 1 : 0)
