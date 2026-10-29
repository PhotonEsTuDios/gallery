// Prüft Herkunftsfilter + Import-Seite live.  set -a; . ./.env; set +a; OUT=… node scripts/peek-herkunft.mjs
import { chromium } from 'playwright'
const PW = process.env.GALLERY_PASSWORD
const OUT = process.env.OUT || '/tmp'
const BASE = 'https://gallery.photonestudios.com'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
const failed = []
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.fill('input[type=password]', PW)
await page.click('button[type=submit]')
await page.waitForSelector('a[href^="/album/"]', { timeout: 20000 })
await page.waitForTimeout(2500)
const all = await page.locator('a[href^="/album/"]').count()
console.log('Alben (alle):', all)
console.log('Filterleiste:', (await page.locator('text=Herkunft').first().innerText().catch(() => 'FEHLT')))
console.log('Chips:', (await page.locator('button:has-text("Time Machine")').innerText().catch(() => '?')).replace(/\s+/g, ' '),
  '|', (await page.locator('button:has-text("Dropbox")').innerText().catch(() => '?')).replace(/\s+/g, ' '))
await page.screenshot({ path: `${OUT}/hk-all.png` })
await page.click('button:has-text("Time Machine")')
await page.waitForResponse((r) => r.url().includes('/api/albums') && r.url().includes('herkunft=timemachine'), { timeout: 20000 })
await page.waitForTimeout(2500)
const tm = await page.locator('a[href^="/album/"]').count()
console.log('Alben (nur Time Machine):', tm, await page.locator('a[href^="/album/"] .text-sm').allInnerTexts().then((x) => x.slice(0, 6)))
await page.screenshot({ path: `${OUT}/hk-tm.png` })
await page.goto(BASE + '/timeline', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: `${OUT}/hk-tl.png` })
await page.goto(BASE + '/import', { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
console.log('Import-Seite:', (await page.locator('section').first().innerText().catch(() => 'FEHLT')).replace(/\s+/g, ' ').slice(0, 400))
await page.screenshot({ path: `${OUT}/hk-import.png`, fullPage: true })
console.log('Fehler-Responses:', failed.length ? failed.slice(0, 8) : 'keine')
await b.close()
