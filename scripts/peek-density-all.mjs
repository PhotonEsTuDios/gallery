// Live-Test: Größe XS…XL wirkt in allen Foto-Ansichten und ist gemeinsam (gallery#14).
// Usage: set -a; . ./.env; set +a; [OUT=…] node scripts/peek-density-all.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const OUT = process.env.OUT || './density-all'
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
let fail = 0
const ok = (n, c, i = '') => { console.log(`${c ? '✓' : '✗'} ${n} ${i}`); if (!c) fail++ }
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (/hydrat/i.test(m.text())) errs.push('hydration: ' + m.text().slice(0, 120)) })
p.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url()) })
await p.goto(BASE + '/login'); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/')
const albums = await (await p.request.fetch(BASE + '/api/albums', { timeout: 60000 })).json()
const album = albums.find((a) => a.count >= 40) ?? albums[0]
const cols = () => p.evaluate(() => { const g = document.querySelector('[data-test=grid]'); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0 })
const w = () => p.evaluate(() => { const i = document.querySelector('[data-test=grid] img'); return i ? new URL(i.src).searchParams.get('w') : null })
for (const [name, path] of [['Album', '/album/' + encodeURIComponent(album.name)], ['Labels', '/labels'], ['Nikon', '/nikon']]) {
  await p.goto(BASE + path, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-test=grid] img', { timeout: 30000 }).catch(() => {})
  await p.click('[data-test=density-XS]'); await p.waitForTimeout(600)
  const xs = await cols(), wxs = await w()
  await p.click('[data-test=density-XL]'); await p.waitForTimeout(600)
  const xl = await cols(), wxl = await w()
  await p.keyboard.press('-'); await p.waitForTimeout(400)
  const l = await cols()
  ok(`${name}: XS > L > XL Spalten, Thumbs 200→800`, xs > l && l > xl && wxs === '200' && wxl === '800', `${xs} > ${l} > ${xl}, w ${wxs}→${wxl}`)
  await p.screenshot({ path: `${OUT}_${name}.png` })
}
// gemeinsam: in Nikon zuletzt L (per Taste) -> Timeline zeigt L
await p.click('[data-test=density-S]'); await p.waitForTimeout(300)
await p.goto(BASE + '/timeline', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-test=density-S]'); await p.waitForTimeout(1500)
ok('gleiche Größe in der Timeline (S)', await p.locator('[data-test=density-S]').evaluate((e) => e.className.includes('bg-neutral-200')))
// Lightbox offen: +/− ändern nichts
await p.goto(BASE + '/album/' + encodeURIComponent(album.name), { waitUntil: 'domcontentloaded' }); await p.waitForSelector('[data-test=grid] img')
await p.locator('[data-test=grid] button').first().click(); await p.waitForTimeout(800)
await p.keyboard.press('+'); await p.keyboard.press('Escape'); await p.waitForTimeout(400)
ok('Lightbox offen: + ändert die Größe nicht', await p.evaluate(() => localStorage.getItem('density')) === 'S')
await p.click('[data-test=density-L]')
ok('keine 5xx/JS/Hydration-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün'); process.exit(fail ? 1 : 0)
