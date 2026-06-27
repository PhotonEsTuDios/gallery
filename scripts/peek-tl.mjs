import { chromium } from 'playwright'

const PW = process.env.GALLERY_PASSWORD
if (!PW) { console.error('GALLERY_PASSWORD fehlt — set -a; . ./.env; set +a; node scripts/peek-tl.mjs'); process.exit(1) }
const OUT = '/private/tmp/claude-501/-Users-potstupimi/b31d89e0-bb7c-473f-b5d7-56faff2739bf/scratchpad'
const BASE = 'https://gallery.photonestudios.com'

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const bad = []
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 90)}`) })
page.on('pageerror', (e) => bad.push('JS: ' + e.message))

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
if (page.url().includes('login') || await page.locator('input[type=password]').count()) {
  await page.fill('input[type=password]', PW)
  await page.click('button[type=submit]')
  await page.waitForURL(BASE + '/', { timeout: 20000 }).catch(() => {})
}
await page.waitForSelector('nav a[href="/timeline"]', { timeout: 20000 })
console.log('Login OK')

await page.click('nav a[href="/timeline"]')
await page.waitForURL(BASE + '/timeline', { timeout: 20000 })
await page.waitForSelector('section[data-ym]', { timeout: 20000 })
console.log('Timeline-Monate:', await page.locator('section[data-ym]').count())
console.log('Erster Monat:', await page.locator('section[data-ym] h2').first().innerText())
await page.waitForTimeout(3500)

// Prüfen, dass die oberen Thumbnails wirklich Pixel haben (naturalWidth > 0)
const rendered = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('section[data-ym] img')]
  return { total: imgs.length, ok: imgs.filter((i) => i.naturalWidth > 0).length }
})
console.log('Thumbnails:', rendered)
await page.screenshot({ path: `${OUT}/live-tl-top.png` })

await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.35))
await page.waitForTimeout(3500)
await page.screenshot({ path: `${OUT}/live-tl-mid.png` })

// Lightbox
const firstBtn = page.locator('section[data-ym] button').first()
await firstBtn.scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await firstBtn.click()
await page.waitForTimeout(1500)
const lb = await page.evaluate(() => {
  const i = document.querySelector('div.fixed.inset-0.z-50 img')
  return i ? { open: true, w: i.naturalWidth } : { open: false }
})
console.log('Lightbox:', lb)
await page.screenshot({ path: `${OUT}/live-tl-lightbox.png` })

console.log('Fehler-Responses:', bad.length ? bad.slice(0, 10) : 'keine')
await b.close()
