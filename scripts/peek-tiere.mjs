// Live-Test Tiere wie Personen (gallery#18): Personen-Seite wie bisher, Umschalter „Tiere“, Gruppen mit Ausschnitten,
// Benennen-Dialog öffnet (es wird NICHTS gespeichert), Timeline + Alben laden, Lightbox zeigt den Tier-Rahmen.
// Usage: set -a; . ./.env; set +a; [OUT=…] [STATE=sitzung.json] [MODE=vorher] node scripts/peek-tiere.mjs
//   MODE=vorher  nur einloggen, Sitzung nach STATE speichern, Zahlen der Personen-Seite ausgeben (vor einem Deploy)
//   STATE=…      vorhandene Sitzung weiterverwenden -> prüft, dass ein Deploy niemanden ausloggt
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const OUT = process.env.OUT || './tiere'
const STATE = process.env.STATE || ''
const VORHER = process.env.MODE === 'vorher'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, storageState: STATE && !VORHER && existsSync(STATE) ? STATE : undefined })
const p = await ctx.newPage()
let fail = 0
const ok = (n, c, i = '') => { console.log(`${c ? '✓' : '✗'} ${n} ${i}`); if (!c) fail++ }
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 120)) })
const json = async (path) => (await p.request.fetch(BASE + path, { timeout: 90000 })).json()
const loaded = (sel) => p.evaluate((s) => { const i = [...document.querySelectorAll(s)]; return { n: i.length, ok: i.filter((x) => x.complete && x.naturalWidth).length } }, sel)

let t = Date.now()
await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
if (p.url().endsWith('/login')) {
  ok('bestehende Sitzung gilt weiter (kein neuer Login nötig)', !(STATE && !VORHER && existsSync(STATE)))
  await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/', { timeout: 90000 })
} else if (STATE && !VORHER) ok('bestehende Sitzung gilt weiter (kein neuer Login nötig)', true)
if (STATE && VORHER) await ctx.storageState({ path: STATE })

// ---- Personen wie bisher ----
t = Date.now()
const pers = await json('/api/personen')
ok('API Personen', pers.named?.length > 0 && pers.total > 0, `${pers.named?.length} benannt, ${pers.total} unbenannte Gruppen, ${Date.now() - t} ms`)
const namen = await json('/api/personen/namen')
ok('API Personen-Namen (Index)', namen.length > 0, `${namen.length} Namen, größte: ${namen.slice(0, 3).map((n) => n.count).join('/')} Fotos`)
if (VORHER) { console.log(`VORHER benannt=${pers.named.length} gruppen=${pers.total} namen=${namen.length} fotos=${namen.reduce((s, n) => s + n.count, 0)}`); await b.close(); process.exit(fail ? 1 : 0) }

await p.goto(`${BASE}/personen`, { waitUntil: 'networkidle', timeout: 90000 })
await p.waitForSelector('[data-test=named] img', { timeout: 60000 }); await p.waitForTimeout(2000)
let im = await loaded('[data-test=named] img, [data-test=groups] img')
ok('Seite Personen: Benannte + Gruppen mit Ausschnitten', im.n > 20 && im.ok > 20, `${im.ok}/${im.n} Bilder geladen (Rest lädt beim Scrollen)`)
ok('Umschalter Personen | Tiere', (await p.locator('[data-test=art] a').count()) === 2)
await p.screenshot({ path: `${OUT}_personen.png` })
await p.locator('[data-test=named] [data-test=person-album]').first().click()
await p.waitForSelector('[data-test=grid] img', { timeout: 90000 }); await p.waitForTimeout(2500)
im = await loaded('[data-test=grid] img')
ok('Personen-Album öffnet', im.n >= 30, `${im.n} Bilder, ${decodeURIComponent(p.url().replace(BASE, '')).replace(/\/person\/.*/, '/person/…')}`)
await p.screenshot({ path: `${OUT}_personen_album.png` })

// ---- Tiere ----
const tiere = await json('/api/personen?art=tiere')
ok('API Tiere', tiere.total + tiere.named.length > 0, `${tiere.named.length} benannt, ${tiere.total} unbenannte Gruppen, gruppiert ${tiere.generated_at}`)
ok('Tier-Gruppen sind keine Personen-Gruppen', tiere.groups.every((g) => g.samples.every((s) => s.startsWith('animals/'))) && pers.groups.every((g) => g.samples.every((s) => s.startsWith('faces/'))))
await p.goto(`${BASE}/personen`, { waitUntil: 'domcontentloaded' })
await p.locator('[data-test=art] a').nth(1).click() // sofort umschalten, während die Personen noch laden
await p.waitForFunction(() => /art=tiere/.test(location.search)); await p.waitForSelector('[data-test=groups] img', { timeout: 60000 }); await p.waitForTimeout(3000)
im = await loaded('[data-test=groups] img')
const srcs = await p.evaluate(() => [...document.querySelectorAll('[data-test=groups] img')].map((i) => i.getAttribute('src')))
const nGroups = await p.locator('[data-test=groups] > div').count()
ok('Seite Tiere: Gruppen mit Ausschnitten', im.ok >= 8 && srcs.every((s) => s.includes('art=tiere')) && nGroups === Math.min(tiere.total, 120), `${im.ok}/${im.n} Ausschnitte, ${nGroups} Gruppen`)
await p.screenshot({ path: `${OUT}_tiere.png`, fullPage: true })
// Benennen-Dialog öffnen, nichts eintragen, wieder schließen
await p.locator('[data-test=benennen]').first().click()
await p.waitForSelector('[data-test=review] .grid img', { timeout: 60000 }); await p.waitForTimeout(2500)
im = await loaded('[data-test=review] .grid img')
ok('Benennen-Dialog: Stichprobe geladen', im.ok >= 3, `${im.ok}/${im.n} Ausschnitte`)
await p.screenshot({ path: `${OUT}_tiere_dialog.png` })
await p.keyboard.press('Escape')
ok('Dialog ohne Speichern geschlossen', (await p.locator('[data-test=review]').count()) === 0)

// ---- übrige Ansichten ----
for (const path of ['/', '/timeline']) {
  const r = await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => null)
  await p.waitForTimeout(2500); im = await loaded('img')
  ok(`Seite ${path}`, r?.status() === 200 && im.ok > 5, `HTTP ${r?.status()}, Bilder ${im.ok}/${im.n}, Filterleiste ${await p.locator('[data-test=filterbar]').count()}`)
  await p.screenshot({ path: `${OUT}_${path.replace(/\W/g, '') || 'alben'}.png` })
}
ok('Filter t= wird verstanden (unbekannter Name = leer)', (await json('/api/timeline?t=GibtEsNicht123')).length === 0)
ok('Filter p= wie bisher', (await json(`/api/timeline?p=${encodeURIComponent(namen[0].name)}`)).length > 0)

// ---- Lightbox: Foto mit Tier zeigt den Rahmen ----
const sha = tiere.groups[0]?.samples[0]?.replace(/^animals\//, '').slice(0, 64)
const faces = sha ? await json(`/api/faces/${sha}?art=tiere`) : { faces: [] }
ok('API Tiere am Foto', faces.faces.length > 0 && faces.faces[0].box?.length === 4, `${faces.faces.length} Tier(e)`)
let album = ''
const alben = await json('/api/albums') // das Album des Fotos suchen, je 8 gleichzeitig
for (let i = 0; i < alben.length && !album; i += 8) {
  const hit = await Promise.all(alben.slice(i, i + 8).map(async (a) => ((await json(`/api/album/${encodeURIComponent(a.name)}`).catch(() => null))?.photos?.some((x) => x.sha === sha) ? a.name : '')))
  album = hit.find(Boolean) || ''
}
ok('Album zum Tier-Foto gefunden', !!album)
if (album) {
  await p.goto(`${BASE}/album/${encodeURIComponent(album)}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-test=grid] button', { timeout: 60000 })
  await p.locator(`[data-test=grid] img[src*="${sha}"]`).scrollIntoViewIfNeeded(); await p.locator(`[data-test=grid] img[src*="${sha}"]`).click()
  await p.waitForSelector('[data-test=faces-bar]', { timeout: 30000 })
  if (!(await p.locator('[data-test=face-box]').count())) await p.keyboard.press('g')
  await p.waitForSelector('[data-test=face-box]', { timeout: 15000 }); await p.waitForTimeout(2500)
  ok('Lightbox: Rahmen sichtbar', (await p.locator('[data-test=face-box]').count()) >= faces.faces.length)
  await p.screenshot({ path: `${OUT}_lightbox.png` })
}

ok('keine 5xx/JS-Fehler', errs.length === 0, errs.slice(0, 5).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün')
process.exit(fail ? 1 : 0)
