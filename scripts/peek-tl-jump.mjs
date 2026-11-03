// gallery#5: Sprung per Jahresleiste + Hochscrollen — wie lange bis Kacheln da sind?
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage()
await p.goto(BASE + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/').catch(() => {})
let monthReqs = 0
p.on('request', (r) => { if (/\/api\/timeline\/\d{4}-\d{2}/.test(r.url())) monthReqs++ })
await p.goto(BASE + '/timeline', { waitUntil: 'networkidle' })
const visibleTile = () => p.waitForFunction(() => [...document.querySelectorAll('section[data-ym] img')].some((i) => { const r = i.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && i.complete && i.naturalWidth > 0 }), null, { timeout: 30000 })
const year = process.env.YEAR || '2007'
monthReqs = 0
let t = Date.now()
await p.locator('nav button', { hasText: new RegExp(`^\\s*${year}\\s*$`) }).first().click()
await visibleTile(); console.log(`Sprung ${year}: Kachel sichtbar nach`, Date.now() - t, 'ms, Monats-Anfragen', monthReqs)
await p.screenshot({ path: 'smoke_tl_jump.png' })
// hochscrollen in Schritten, je Schritt messen
for (let i = 1; i <= 4; i++) {
  monthReqs = 0; t = Date.now()
  await p.mouse.wheel(0, -3000); await p.waitForTimeout(100)
  const ok = await visibleTile().then(() => true).catch(() => false)
  console.log(`hoch ${i}: ${ok ? Date.now() - t + ' ms' : 'TIMEOUT'}, Monats-Anfragen ${monthReqs}`)
}
await b.close()
