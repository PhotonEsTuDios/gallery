import { chromium } from 'playwright'

// Selbsttest Nikon-Seite: Kameras/Jahre/Kacheln zählen, Screenshot, Lightbox mit Säulen öffnen.
const PW = process.env.GALLERY_PASSWORD
const OUT = process.env.OUT || '.'
const BASE = process.env.BASE || 'http://localhost:3000'
if (!PW) { console.error('GALLERY_PASSWORD fehlt'); process.exit(1) }
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('pageerror:', e.message))

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.fill('input[type=password]', PW)
await page.click('button[type=submit]')
await page.waitForURL(BASE + '/')

const api = await page.evaluate(() => fetch('/api/nikon').then((r) => r.json()))
const models = {}
for (const p of api) models[p.model] = (models[p.model] ?? 0) + 1
console.log('API Nikon-Bilder:', api.length, models)

await page.goto(BASE + '/nikon', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('section .grid > button', { timeout: 90000 })
await page.waitForTimeout(6000)
console.log('Jahre:', (await page.locator('div.mb-3.flex.flex-wrap.gap-1 button').allInnerTexts()).join(' · '))
console.log('Monatsgruppen:', await page.locator('section h2').count(), '| Kacheln:', await page.locator('section .grid > button').count())
await page.screenshot({ path: `${OUT}/pw-nikon.png` })

await page.locator('section .grid > button').first().click()
await page.waitForSelector('[data-test=pillars]')
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/pw-nikon-lightbox.png` })
console.log('Lightbox mit Säulen: ok')
await b.close()
