import { chromium } from 'playwright'

const OUT = '/private/tmp/claude-501/-Users-potstupimi/d63148d1-fec0-4f87-84c4-40ecf95876cb/scratchpad'
const BASE = 'https://gallery.photonestudios.com'
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: 1440, height: 900 } })

const failed = []
page.on('requestfailed', (r) => failed.push(r.url()))
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
console.log('Nach / -> URL:', page.url())

// Login
await page.fill('input[type=password]', 'Aschenbroedel4')
await page.screenshot({ path: `${OUT}/live-login.png` })
await page.click('button[type=submit]')
await page.waitForURL(BASE + '/', { timeout: 15000 }).catch(() => {})
await page.waitForSelector('a[href^="/album/"]', { timeout: 15000 })
const albums = await page.locator('a[href^="/album/"]').count()
console.log('Login OK. Alben sichtbar:', albums)
await page.waitForTimeout(3000)
await page.screenshot({ path: `${OUT}/live-albums.png` })

// Ein Album öffnen
await page.locator('a[href^="/album/"]').first().click()
await page.waitForSelector('div.grid > button img', { timeout: 15000 })
await page.waitForTimeout(3500)
await page.screenshot({ path: `${OUT}/live-album.png` })

console.log('Fehlgeschlagene Requests:', failed.length ? failed.slice(0, 8) : 'keine')
await b.close()
