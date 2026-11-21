// Live-Test Sterne (gallery#19), Auswahl entfernt (gallery#20), Umschalter + Erkennungs-Fortschritt (gallery#21).
// Bewertet EIN Foto (4 Sterne), prüft nach Neuladen, nimmt die Bewertung wieder zurück. Sonst wird nichts gespeichert.
// Usage: set -a; . ./.env; set +a; [OUT=…] [STATE=sitzung.json] [ERWARTET="benannt=119 gruppen=632"] node scripts/peek-sterne.mjs
//   STATE=…     vorhandene Sitzung weiterverwenden -> prüft, dass ein Deploy niemanden ausloggt
//   ERWARTET=…  Zahlen der Personen-Seite von vor dem Deploy (Ausgabe von MODE=vorher peek-tiere.mjs)
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const OUT = process.env.OUT || './sterne'
const STATE = process.env.STATE || ''
const ERW = Object.fromEntries((process.env.ERWARTET || '').split(/\s+/).filter(Boolean).map((x) => x.split('=')))
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, storageState: STATE && existsSync(STATE) ? STATE : undefined })
const p = await ctx.newPage()
let fail = 0
const ok = (n, c, i = '') => { console.log(`${c ? '✓' : '✗'} ${n} ${i}`); if (!c) fail++ }
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
// 404 auf den entfernten Adressen ist gewollt; gezählt werden nur 5xx
p.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 120)) })
const posts = []; p.on('request', (r) => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname.replace(/[0-9a-f]{64}/, '<sha>')) })
const get = (path) => p.request.fetch(BASE + path, { timeout: 90000 })
const json = async (path) => (await get(path)).json()
const loaded = (sel) => p.evaluate((s) => { const i = [...document.querySelectorAll(s)]; return { n: i.length, ok: i.filter((x) => x.complete && x.naturalWidth).length } }, sel)

await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
if (p.url().endsWith('/login')) {
  if (STATE && existsSync(STATE)) ok('bestehende Sitzung gilt weiter (kein neuer Login nötig)', false)
  await p.fill('input[type=password]', process.env.GALLERY_PASSWORD); await p.click('button[type=submit]'); await p.waitForURL(BASE + '/', { timeout: 90000 })
} else if (STATE) ok('bestehende Sitzung gilt weiter (kein neuer Login nötig)', true)

// ---- Personen + Tiere: Zahlen wie vorher, Umschalter sichtbar (#21) ----
const pers = await json('/api/personen')
const namen = await json('/api/personen/namen')
const tiere = await json('/api/personen?art=tiere')
const ist = { benannt: pers.named.length, gruppen: pers.total, namen: namen.length, fotos: namen.reduce((s, n) => s + n.count, 0), tiergruppen: tiere.total, tierbenannt: tiere.named.length }
console.log('ZAHLEN ' + Object.entries(ist).map(([k, v]) => `${k}=${v}`).join(' '))
ok('API Personen + Tiere', ist.benannt > 0 && ist.gruppen > 0 && ist.tiergruppen + ist.tierbenannt > 0)
if (Object.keys(ERW).length) ok('Zahlen wie vor dem Deploy', Object.entries(ERW).every(([k, v]) => String(ist[k]) === v), Object.entries(ERW).map(([k, v]) => `${k} ${v}→${ist[k]}`).join(', '))

await p.goto(`${BASE}/personen`, { waitUntil: 'networkidle', timeout: 90000 })
await p.waitForSelector('[data-test=named] img', { timeout: 60000 }); await p.waitForTimeout(2000)
let im = await loaded('[data-test=named] img, [data-test=groups] img')
ok('Seite Personen: Benannte + Gruppen mit Ausschnitten', im.n > 20 && im.ok > 20 && (await p.locator('[data-test=named] > div').count()) === ist.benannt, `${im.ok}/${im.n} Bilder, ${ist.benannt} benannt`)
// Umschalter: beide Reiter gut sichtbar = heller Text oder helle Fläche, mit Rahmen drumherum
const tabs = () => p.evaluate(() => {
  const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); return m.length > 3 && m[3] === 0 ? -1 : (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255 }
  const box = document.querySelector('[data-test=art]')
  return { border: parseFloat(getComputedStyle(box).borderTopWidth), tabs: [...box.querySelectorAll('a')].map((a) => { const s = getComputedStyle(a); const r = a.getBoundingClientRect(); return { text: a.textContent.trim(), fg: lum(s.color), bg: lum(s.backgroundColor), w: Math.round(r.width), h: Math.round(r.height), current: a.getAttribute('aria-current') } }) }
})
let sw = await tabs()
const fmtTabs = (s) => s.tabs.map((x) => `${x.text}: Text ${x.fg.toFixed(2)}${x.bg >= 0 ? `, Fläche ${x.bg.toFixed(2)}` : ''}${x.current ? ' (gewählt)' : ''}`).join(' | ')
ok('Umschalter: zwei Reiter im Rahmen, „Personen“ gewählt (helle Fläche), „Tiere“ heller Text', sw.border >= 1 && sw.tabs.length === 2 && sw.tabs[0].current === 'page' && sw.tabs[0].bg > 0.8 && sw.tabs[0].fg < 0.2 && !sw.tabs[1].current && sw.tabs[1].fg > 0.75 && sw.tabs.every((x) => x.h >= 28 && x.w >= 70), fmtTabs(sw))
await p.screenshot({ path: `${OUT}_personen.png` })
await p.locator('[data-test=art] a').nth(1).click()
await p.waitForFunction(() => /art=tiere/.test(location.search)); await p.waitForSelector('[data-test=groups] img', { timeout: 60000 }); await p.waitForTimeout(3000)
sw = await tabs()
im = await loaded('[data-test=groups] img')
const nGroups = await p.locator('[data-test=groups] > div').count()
ok('Seite Tiere: Gruppen mit Ausschnitten, „Tiere“ gewählt', im.ok >= 8 && nGroups === Math.min(ist.tiergruppen, 120) && sw.tabs[1].current === 'page' && sw.tabs[1].bg > 0.8 && sw.tabs[0].fg > 0.75, `${im.ok}/${im.n} Ausschnitte, ${nGroups} Gruppen · ${fmtTabs(sw)}`)
await p.screenshot({ path: `${OUT}_tiere.png` })

// ---- Auswahl ist weg (#20) ----
const nav = await p.locator('header nav a').allInnerTexts()
ok('Reiter „Auswahl“ ist weg, die anderen sind da', !nav.some((t) => /auswahl/i.test(t)) && ['Alben', 'Timeline', 'Labels', 'Karte', 'Nikon', 'Personen', 'Import'].every((t) => nav.some((x) => x.trim().toLowerCase() === t.toLowerCase())), nav.map((t) => t.trim()).join(' · '))
ok('Seite /auswahl gibt es nicht mehr', (await get('/auswahl')).status() === 404)
ok('API /api/portfolio gibt es nicht mehr', (await get('/api/portfolio')).status() === 404)

// ---- Import: Fortschritt der Erkennung (#21) ----
const runs = await json('/api/erkennung')
ok('API Erkennung: Tiere + Gesichter', runs.length === 2 && runs[0].key === 'tiere' && runs[1].key === 'gesichter' && runs.every((r) => ['fertig', 'läuft', 'noch nicht gelaufen'].includes(r.state)), runs.map((r) => `${r.key} ${r.state} ${r.done}/${r.total}, gefunden ${r.found}, Fehler ${r.err}, Pakete ${r.packages_done}/${r.packages}`).join(' | '))
await p.goto(`${BASE}/import`, { waitUntil: 'networkidle', timeout: 90000 })
await p.waitForSelector('[data-test=run-tiere]', { timeout: 60000 }); await p.waitForTimeout(1000)
const de = (n) => n.toLocaleString('de-DE')
const tTxt = (await p.locator('[data-test=run-tiere]').innerText()).replace(/\s+/g, ' ')
const gTxt = (await p.locator('[data-test=run-gesichter]').innerText()).replace(/\s+/g, ' ')
ok('Seite Import: Tier-Erkennung mit Zahlen', tTxt.includes('Tier-Erkennung') && tTxt.includes(runs[0].state) && (!runs[0].total || (tTxt.includes(`${de(runs[0].done)} / ${de(runs[0].total)}`) && tTxt.includes(de(runs[0].found)) && (await p.locator('[data-test=run-tiere] [data-test=run-bar]').count()) === 1)), tTxt.slice(0, 200))
ok('Seite Import: Gesichtserkennung', gTxt.includes('Gesichtserkennung') && gTxt.includes(runs[1].state), gTxt.slice(0, 200))
ok('Seite Import: Importe stehen weiter da', (await p.locator('main section').count()) >= 3)
await p.screenshot({ path: `${OUT}_import.png`, fullPage: true })

// ---- Lightbox: Sterne (#19), alte Knöpfe weg (#20) ----
const alben = await json('/api/albums')
let album = '', sha = ''
for (const a of alben.slice(0, 20)) { // erstes Album mit einem noch unbewerteten Foto
  const ph = (await json(`/api/album/${encodeURIComponent(a.name)}`)).photos?.filter((x) => x.kind !== 'video').slice(0, 5) ?? []
  for (const x of ph) if ((await json(`/api/rating/${x.sha}`)).rating === null) { album = a.name; sha = x.sha; break }
  if (sha) break
}
ok('unbewertetes Test-Foto gefunden', !!sha)
console.log(`TESTFOTO ${sha}`)
ok('API Bewertung: ungültiges wird abgelehnt', (await get('/api/rating/__animals__')).status() === 400)
const openPhoto = async () => {
  await p.goto(`${BASE}/album/${encodeURIComponent(album)}`, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[data-test=grid] button', { timeout: 60000 })
  const ratingLoaded = p.waitForResponse((r) => r.url().includes(`/api/rating/${sha}`) && r.request().method() === 'GET', { timeout: 30000 })
  await p.locator(`[data-test=grid] img[src*="${sha}"]`).first().scrollIntoViewIfNeeded(); await p.locator(`[data-test=grid] img[src*="${sha}"]`).first().click()
  await p.waitForSelector('[data-test=stars]', { timeout: 30000 }); await ratingLoaded; await p.waitForTimeout(800)
}
const shown = () => p.evaluate(() => ({ rating: Number(document.querySelector('[data-test=stars]').dataset.rating), gold: [...document.querySelectorAll('[data-test=star]')].filter((s) => s.getAttribute('aria-pressed') === 'true').length }))
if (sha) {
  await openPhoto()
  ok('Lightbox: fünf Sterne, noch keine Bewertung', (await p.locator('[data-test=star]').count()) === 5 && (await shown()).gold === 0)
  const body = (await p.locator('body').innerText())
  ok('Lightbox: Knöpfe Seen / Light / The Eye / Archive sind weg', (await p.locator('[data-test=pillars]').count()) === 0 && !/\b(Seen|The Eye|Archive)\b/.test(body))
  const before = posts.length
  for (const k of ['1', '2', '3', '4', '5', '0']) await p.keyboard.press(k)
  await p.waitForTimeout(800)
  ok('Tasten 0–5 tun nichts (weder Säule noch Sterne)', posts.length === before && (await shown()).gold === 0 && (await json(`/api/rating/${sha}`)).rating === null)

  let saved = p.waitForResponse((r) => r.url().includes(`/api/rating/${sha}`) && r.request().method() === 'POST', { timeout: 30000 })
  await p.locator('[data-test=star]').nth(3).click()
  let res = await saved
  await p.mouse.move(700, 300); await p.waitForTimeout(500)
  let api = await json(`/api/rating/${sha}`)
  ok('Klick auf den 4. Stern speichert', res.status() === 200 && (await shown()).gold === 4 && api.rating === 4 && !!api.rated_at, `HTTP ${res.status()}, API ${api.rating} Sterne, rated_at gesetzt: ${!!api.rated_at}`)
  await p.screenshot({ path: `${OUT}_lightbox.png` })

  await p.reload({ waitUntil: 'domcontentloaded' }); await openPhoto()
  ok('nach Neuladen + erneutem Öffnen: 4 Sterne', (await shown()).gold === 4 && (await shown()).rating === 4)
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500)
  const neighbour = await shown()
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1500)
  ok('Nachbarfoto zeigt nicht dieselben Sterne, zurück wieder 4', neighbour.gold !== 4 && (await shown()).gold === 4, `Nachbar ${neighbour.gold}`)

  saved = p.waitForResponse((r) => r.url().includes(`/api/rating/${sha}`) && r.request().method() === 'POST', { timeout: 30000 })
  await p.locator('[data-test=star]').nth(3).click()
  res = await saved
  await p.mouse.move(700, 300); await p.waitForTimeout(500)
  api = await json(`/api/rating/${sha}`)
  ok('derselbe Stern nochmal nimmt die Bewertung zurück', res.status() === 200 && (await shown()).gold === 0 && api.rating === null && api.rated_at === null)
  ok('kein Fehlerhinweis an den Sternen', (await p.locator('[data-test=stars-error]').count()) === 0)
}

// ---- übrige Ansichten ----
for (const path of ['/', '/timeline', '/nikon']) {
  const r = await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => null)
  await p.waitForTimeout(2500); im = await loaded('img')
  ok(`Seite ${path}`, r?.status() === 200 && im.ok > 5, `HTTP ${r?.status()}, Bilder ${im.ok}/${im.n}`)
}

ok('keine 5xx/JS-Fehler', errs.length === 0, errs.slice(0, 5).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün')
process.exit(fail ? 1 : 0)
