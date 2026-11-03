// gallery#6: Video in der Lightbox öffnen -> genau ein <video>, kein <img> daneben
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage()
await p.goto(BASE + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/').catch(() => {})
await p.goto(BASE + '/timeline', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: 'Videos', exact: true }).click()
const tile = p.locator('section[data-ym] button.group').first()
await tile.waitFor({ timeout: 30000 }); await tile.click()
await p.waitForFunction(() => document.querySelector('.fixed.inset-0 video')?.getAttribute('src'), null, { timeout: 15000 })
await p.waitForTimeout(1000)
const r = await p.evaluate(() => { const o = document.querySelector('.fixed.inset-0'); return { videos: o.querySelectorAll('video').length, imgs: o.querySelectorAll('img').length } })
await p.screenshot({ path: 'smoke_lightbox_video.png' })
console.log(r, r.videos === 1 && r.imgs === 0 ? 'OK' : 'FEHLER'); await b.close(); process.exit(r.imgs === 0 ? 0 : 1)
