import { chromium } from 'playwright'

const PW = process.env.GALLERY_PASSWORD
if (!PW) { console.error('GALLERY_PASSWORD fehlt — mit: set -a; . ./.env; set +a; node scripts/peek.mjs'); process.exit(1) }
const OUT = '/private/tmp/claude-501/-Users-potstupimi/d63148d1-fec0-4f87-84c4-40ecf95876cb/scratchpad'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })

// Login
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
await page.fill('input[type=password]', PW)
await page.click('button[type=submit]')
await page.waitForURL('http://localhost:3000/')
await page.waitForSelector('a[href^="/album/"]')

const albumCount = await page.locator('a[href^="/album/"]').count()
console.log('Alben sichtbar:', albumCount)
await page.waitForTimeout(2500)
await page.screenshot({ path: `${OUT}/pw-albums.png` })

// Großes Schnappschuss-Album öffnen
const link = page.locator('a[href^="/album/"]', { hasText: 'Schnappschüsse' }).first()
const name = await link.innerText()
await link.click()
await page.waitForSelector('button img', { timeout: 15000 })
await page.waitForTimeout(3500)
const tiles = await page.locator('div.grid > button').count()
console.log('Album geöffnet:', name.split('\n')[0], '| Kacheln im DOM:', tiles)
await page.screenshot({ path: `${OUT}/pw-album.png` })

await b.close()
