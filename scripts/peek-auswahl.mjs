import { chromium } from 'playwright'

// Selbsttest Portfolio-Auswahl: Labels → Bild öffnen → Taste 2 (Light) → /auswahl zeigt es → wieder raus.
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

await page.goto(BASE + '/labels', { waitUntil: 'networkidle' })
await page.waitForSelector('div.grid > button', { timeout: 60000 })
await page.locator('div.grid > button').first().click()
await page.waitForSelector('[data-test=pillars]')
await page.keyboard.press('2')
await page.waitForTimeout(1500)
await page.screenshot({ path: `${OUT}/pw-lightbox-pick.png` })
const active = await page.locator('[data-test=pillars] button.bg-neutral-100').innerText()
console.log('Aktive Säule in Lightbox:', active.trim())

await page.goto(BASE + '/auswahl', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Light/ }).first().click()
await page.waitForTimeout(800)
const tiles = await page.locator('div.grid > button').count()
console.log('Kacheln in Auswahl/Light:', tiles)
await page.screenshot({ path: `${OUT}/pw-auswahl.png` })

// Aufräumen: in der Lightbox wieder rausnehmen
await page.locator('div.grid > button').first().click()
await page.waitForSelector('[data-test=pillars]')
await page.keyboard.press('0')
await page.waitForTimeout(1500)
const api = await page.evaluate(() => fetch('/api/portfolio').then((r) => r.json()))
console.log('Picks nach Entfernen:', Object.keys(api.picks).length)
await b.close()
