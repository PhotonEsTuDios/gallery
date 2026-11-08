// Live-Test Timeline-Abschnitte (gallery#11): Nepo-Filter fasst zusammen, ungefiltert bleiben Monate.
// Usage: set -a; . ./.env; set +a; [OUT=…] node scripts/peek-tl-buckets.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const OUT = process.env.OUT || './tl-buckets'
const P = process.env.PERSON || 'Nepo'
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
let fail = 0
const ok = (n, c, i = '') => { console.log(`${c ? '✓' : '✗'} ${n} ${i}`); if (!c) fail++ }
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url()) })
await p.goto(BASE + '/login'); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/')
const get = async (u) => (await p.request.fetch(BASE + u, { timeout: 60000 })).json()
const all = await get("/api/timeline"); if (!Array.isArray(all)) { console.log("Antwort:", JSON.stringify(all).slice(0, 400)); process.exit(1) }
const spans = (l) => l.reduce((m, x) => ({ ...m, [x.span]: (m[x.span] || 0) + 1 }), {})
ok('ungefiltert: überwiegend Monate', (spans(all).month || 0) > all.length * 0.7, JSON.stringify(spans(all)))
const nepo = await get(`/api/timeline?p=${encodeURIComponent(P)}`)
const sum = (l) => l.reduce((s, x) => s + x.count, 0)
const thin = nepo.filter((x) => x.span === 'month' && x.count < 15)
ok(`${P}: keine dünnen Monate mehr`, thin.length === 0, `${nepo.length} Abschnitte ${JSON.stringify(spans(nepo))}, ${sum(nepo)} Fotos${thin.length ? ' dünn: ' + thin.map((x) => x.ym).join(',') : ''}`)
const order = nepo.filter((x) => x.ym !== '0000-00').map((x) => x.ym.slice(0, 4))
ok(`${P}: Jahre absteigend`, order.every((y, i) => i === 0 || y <= order[i - 1]))
ok(`${P}: keine Fotos verloren`, sum(nepo) > 0)
const q = nepo.find((x) => x.span !== 'month' && x.ym !== '0000-00')
if (q) {
  const r = await get(`/api/timeline/${q.ym}?p=${encodeURIComponent(P)}`)
  ok(`Abschnitt ${q.ym} („${q.label}“) lädt alle Fotos`, r.total === q.count, `${r.total} = ${q.count}`)
}
ok('kaputter Schlüssel abgelehnt', (await p.request.fetch(BASE + '/api/timeline/2026-Q9')).status() === 400)
await p.goto(BASE + `/timeline?p=${encodeURIComponent(P)}`, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('main section img', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(2500)
const heads = await p.locator('main section h2').allTextContents()
ok('Überschriften sichtbar', heads.length > 0, heads.slice(0, 6).map((h) => h.replace(/\s+/g, ' ').trim()).join(' | '))
await p.screenshot({ path: `${OUT}_nepo.png` })
ok('keine 5xx/JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün'); process.exit(fail ? 1 : 0)
