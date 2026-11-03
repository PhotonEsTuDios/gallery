// gallery#5: wie lange brauchen Thumbnails nach dem Sprung (Erzeugung vs. Cache)?
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage()
await p.goto(BASE + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/').catch(() => {})
await p.goto(BASE + '/timeline', { waitUntil: 'networkidle' })
const times = []
p.on('requestfinished', async (r) => { if (r.url().includes('/img/')) { const t = r.timing(); const h = (await r.response())?.headers() ?? {}; times.push([Math.round(t.responseEnd), h['x-cache'] || '?']) } })
await p.locator('nav button', { hasText: /^\s*(o\.D\.)\s*$/ }).first().click()
await p.waitForTimeout(15000)
times.sort((a, b) => a[0] - b[0])
const hits = times.filter((x) => /Hit/i.test(x[1])).length
console.log('Thumbs', times.length, 'CF-Hit', hits, 'Median ms', times[times.length >> 1]?.[0], 'max', times.at(-1)?.[0])
const vis = await p.evaluate(() => { const im = [...document.querySelectorAll('section[data-ym] img')].filter((i) => { const r = i.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight }); return [im.filter((i) => i.complete && i.naturalWidth).length, im.length] })
console.log('sichtbar fertig/gesamt nach 15 s', vis)
await b.close()
