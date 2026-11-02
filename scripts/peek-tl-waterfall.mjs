// gallery#3: Wasserfall der Timeline-Ladezeit (welche Anfrage blockiert die erste Kachel?)
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage()
await p.goto(BASE + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/').catch(() => {})
const t0 = Date.now(); const ev = []
p.on('request', (r) => ev.push([Date.now() - t0, '→', r.url().replace(BASE, '').slice(0, 70)]))
p.on('requestfinished', (r) => ev.push([Date.now() - t0, '✓', r.url().replace(BASE, '').slice(0, 70)]))
await p.goto(BASE + '/timeline', { waitUntil: 'domcontentloaded' })
const tFirst = await p.waitForFunction(() => [...document.querySelectorAll('section[data-ym] img')].some((i) => i.src.includes('/img/') && i.complete && i.naturalWidth > 0), null, { timeout: 60000 }).then(() => Date.now() - t0)
console.log('erste Kachel', tFirst, 'ms')
let imgs = 0
for (const e of ev.sort((a, b) => a[0] - b[0])) { if (e[0] > tFirst + 200) break; if (e[2].startsWith('/img/')) { if (++imgs > 6) continue } ; if (/\.(js|css|woff2?)/.test(e[2])) continue; console.log(String(e[0]).padStart(5), e[1], e[2]) }
await b.close()
