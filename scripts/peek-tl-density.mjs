// Live-Test Vorschaugrößen XS…XL + Tasten +/− (gallery#13).
// Usage: set -a; . ./.env; set +a; [OUT=…] node scripts/peek-tl-density.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const OUT = process.env.OUT || './tl-density'
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
let fail = 0
const ok = (n, c, i = '') => { console.log(`${c ? '✓' : '✗'} ${n} ${i}`); if (!c) fail++ }
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url()) })
await p.goto(BASE + '/login'); await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/')
await p.goto(BASE + '/timeline', { waitUntil: 'domcontentloaded' })
await p.waitForSelector('section[data-ym] img', { timeout: 30000 })
const state = () => p.evaluate(() => {
  const g = document.querySelector('section[data-ym] div[style*="grid"]')
  const cols = g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0
  const im = [...document.querySelectorAll('section[data-ym] img')].filter((i) => { const r = i.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight })
  const w = im[0] ? new URL(im[0].src).searchParams.get('w') : null
  return { cols, w, vis: im.length, done: im.filter((i) => i.complete && i.naturalWidth).length, sel: localStorage.getItem('tl-density') }
})
const res = {}
for (const d of ['XS', 'S', 'M', 'L', 'XL']) {
  await p.click(`[data-test=density-${d}]`)
  await p.waitForTimeout(3500)
  res[d] = await state()
  ok(`Größe ${d}`, res[d].cols > 0 && res[d].done > 0 && res[d].sel === d, `${res[d].cols} Spalten, w=${res[d].w}, sichtbar ${res[d].done}/${res[d].vis}`)
  await p.screenshot({ path: `${OUT}_${d}.png` })
}
const c = ['XS', 'S', 'M', 'L', 'XL'].map((d) => res[d].cols)
ok('Spalten nehmen ab XS → XL', c.every((x, i) => i === 0 || x < c[i - 1]), c.join(' > '))
ok('Thumbnail-Breiten 200/200/400/400/800', ['XS', 'S', 'M', 'L', 'XL'].map((d) => res[d].w).join() === '200,200,400,400,800')
await p.keyboard.press('-'); await p.waitForTimeout(500)
ok('Taste − verkleinert (XL → L)', (await state()).sel === 'L')
await p.keyboard.press('Minus'); await p.keyboard.press('-'); await p.keyboard.press('-'); await p.keyboard.press('-'); await p.waitForTimeout(500)
ok('Taste − bleibt bei XS stehen', (await state()).sel === 'XS')
await p.keyboard.press('+'); await p.waitForTimeout(500)
ok('Taste + vergrößert (XS → S)', (await state()).sel === 'S')
await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForSelector('section[data-ym] img', { timeout: 30000 }); await p.waitForTimeout(1500)
ok('Auswahl bleibt nach Neuladen', (await state()).sel === 'S')
// XS: schnell scrollen, Bilder müssen nachkommen
await p.click('[data-test=density-XS]'); await p.waitForTimeout(1500)
const t0 = Date.now()
for (let i = 0; i < 8; i++) { await p.mouse.wheel(0, 900); await p.waitForTimeout(250) }
await p.waitForTimeout(4000)
const xs = await state()
ok('XS: nach schnellem Scrollen Bilder da', xs.done >= xs.vis * 0.8 && xs.vis > 50, `${xs.done}/${xs.vis} in ${Date.now() - t0} ms`)
await p.click('[data-test=density-L]')
ok('keine 5xx/JS-Fehler', errs.length === 0, errs.slice(0, 3).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün'); process.exit(fail ? 1 : 0)
