// Gesamttest der Gallery (infra#13): Login (signierter POST), alle Hauptseiten, Bilder geladen, keine Fehler.
// Usage: set -a; . ./.env; set +a; BASE=https://… OUT=/pfad/prefix node scripts/smoke.mjs
import { chromium } from 'playwright'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const PW = process.env.GALLERY_PASSWORD
const OUT = process.env.OUT || './smoke'
if (!PW) { console.error('GALLERY_PASSWORD fehlt'); process.exit(1) }

const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
const errs = []
p.on('pageerror', e => errs.push('pageerror ' + e.message))
p.on('response', r => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 140)) })
let fail = 0
const ok = (name, cond, info = '') => { console.log(`${cond ? '✓' : '✗'} ${name} ${info}`); if (!cond) fail++ }

await p.goto(BASE + '/', { waitUntil: 'networkidle' })
ok('Redirect auf /login', p.url().endsWith('/login'))
await p.fill('input[type=password]', PW)
await p.click('button[type=submit]')
await p.waitForURL(BASE + '/', { timeout: 20000 }).catch(() => {})
ok('Login', p.url() === BASE + '/', p.url())

const imgs = async () => {
  await p.evaluate(async () => { for (let y = 0; y < 3000; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 150)) } scrollTo(0, 0) })
  await p.waitForTimeout(2500)
  return p.evaluate(() => { const i = [...document.images].filter(x => x.getAttribute('src')); return { n: i.length, loaded: i.filter(x => x.complete && x.naturalWidth).length } })
}
for (const path of ['/', '/timeline', '/labels', '/map', '/auswahl', '/nikon', '/import']) {
  const r = await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => null)
  const st = r ? r.status() : 0
  const im = await imgs()
  ok(`Seite ${path}`, st === 200, `HTTP ${st}, Bilder ${im.loaded}/${im.n}`)
  await p.screenshot({ path: `${OUT}_${path.replace(/\W/g, '') || 'home'}.png` })
}
// erstes Album öffnen + Lightbox
await p.goto(BASE + '/', { waitUntil: 'networkidle' })
const album = await p.$('a[href^="/album/"], a[href*="/a/"]')
if (album) {
  await album.click(); await p.waitForLoadState('networkidle'); const im = await imgs()
  ok('Album', im.loaded > 0, `${p.url().replace(BASE, '')} Bilder ${im.loaded}/${im.n}`)
  await p.screenshot({ path: `${OUT}_album.png` })
} else ok('Album-Link gefunden', false)

ok('keine 5xx/JS-Fehler', errs.length === 0, errs.slice(0, 5).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün')
process.exit(fail ? 1 : 0)
