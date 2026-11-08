// End-to-End-Test Personen + Filter + Lightbox-Gesichter (gallery#7/#8/#9).
// Usage: set -a; . ./.env; set +a; BASE=https://gallery.photonestudios.com [WRITE=1] node scripts/faces-check.mjs
// WRITE=1: benennt EIN Gesicht als „Testperson Claude“, prüft Filter/Timeline/Lightbox, nimmt den Namen wieder weg.
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
const BASE = process.env.BASE || 'https://gallery.photonestudios.com'
const PW = process.env.GALLERY_PASSWORD
const OUT = process.env.OUT || './faces'
const TEST = 'Testperson Claude'
if (!PW) { console.error('GALLERY_PASSWORD fehlt'); process.exit(1) }

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push('pageerror ' + e.message))
p.on('response', (r) => { if (r.status() >= 500) errs.push(r.status() + ' ' + r.url().slice(0, 140)) })
let fail = 0
const ok = (name, cond, info = '') => { console.log(`${cond ? '✓' : '✗'} ${name} ${info}`); if (!cond) fail++ }
const api = async (path, opts) => {
  const r = await p.request.fetch(BASE + path, opts)
  return { status: r.status(), json: r.ok() ? await r.json() : null }
}
const post = (path, body) => {
  const data = JSON.stringify(body)
  return api(path, { method: 'POST', timeout: 120000, data, headers: { 'content-type': 'application/json', 'x-amz-content-sha256': createHash('sha256').update(data).digest('hex') } })
}
const loadedImgs = (sel) => p.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.complete && x.naturalWidth).length, sel)

// --- Schutz ohne Login ---
ok('API ohne Login gesperrt', (await api('/api/personen')).status === 401)

await p.goto(BASE + '/login', { waitUntil: 'networkidle' })
await p.fill('input[type=password]', PW)
await p.click('button[type=submit]')
await p.waitForURL(BASE + '/', { timeout: 20000 }).catch(() => {})
ok('Login', p.url() === BASE + '/')

// --- #7 Personen-Seite ---
const per = await api('/api/personen')
ok('API /api/personen', per.status === 200 && per.json.total > 0, `Gruppen ${per.json?.total}, benannt ${per.json?.named.length}`)
await p.goto(BASE + '/personen', { waitUntil: 'networkidle' })
await p.waitForSelector('[data-test=groups] img', { timeout: 20000 }).catch(() => {})
await p.waitForTimeout(1500)
ok('Personen-Seite: Gesichter geladen', (await loadedImgs('[data-test=groups] img')) >= 8)
await p.screenshot({ path: `${OUT}_personen.png` })
await p.click('[data-test=groups] [data-test=benennen] >> nth=0')
await p.waitForSelector('[data-test=review] img', { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(1500)
ok('Benennen-Dialog: Stichprobe 40', (await loadedImgs('[data-test=review] img')) >= 30, `${await loadedImgs('[data-test=review] img')} Bilder`)
ok('Benennen-Dialog: Namensfeld hat Fokus', await p.evaluate(() => document.activeElement?.getAttribute('data-test') === 'dlg-name'))
await p.click('[data-test=dlg-save]')
ok('Speichern ohne Namen -> Hinweis', (await p.locator('[data-test=dlg-error]').textContent())?.includes('Namen'))
await p.screenshot({ path: `${OUT}_pruefen.png` })
await p.keyboard.press('Escape')
const smp = await api(`/api/personen/${per.json.groups[0].cluster}`)
ok('Stichprobe API', smp.status === 200 && smp.json.faces.length === 40 && smp.json.next === 40)

// --- #8 Filter ---
const all = await api('/api/timeline')
const blau = await api('/api/timeline?farbe=Blau')
const sum = (ms) => ms.reduce((s, m) => s + m.count, 0)
ok('Filter Farbe wirkt', sum(blau.json) > 0 && sum(blau.json) < sum(all.json), `${sum(blau.json)} von ${sum(all.json)}`)
const jahr = await api('/api/timeline?jahr=2020')
ok('Filter Jahr wirkt', jahr.json.length > 0 && jahr.json.every((m) => m.ym.startsWith('2020')), `${jahr.json.length} Monate`)
ok('Unsinn-Filter = kein Filter', sum((await api('/api/timeline?farbe=Kariert')).json) === sum(all.json))
await p.goto(BASE + '/timeline?farbe=Blau&jahr=2020', { waitUntil: 'networkidle' })
ok('Filterleiste zeigt aktive Chips', (await p.locator('[data-test=filterbar] button:has-text("2020")').count()) > 0)
await p.click('nav >> text=Labels')
await p.waitForLoadState('networkidle')
ok('Filter wandert mit (Labels)', p.url().includes('farbe=Blau') && p.url().includes('jahr=2020'), p.url().replace(BASE, ''))

// --- #9 + Schreibweg (nur WRITE=1) ---
if (process.env.WRITE === '1') {
  const grp = per.json.groups[0].cluster
  const face = (await api(`/api/personen/${grp}`)).json.faces[0]
  const name = await post('/api/personen', { actions: [{ mode: 'name_face', sha: face.sha, face: face.face, person: TEST }] })
  ok('Gesicht benennen', name.status === 200, `${face.sha.slice(0, 8)}_${face.face}`)
  ok('Name in Filter-Liste', ((await api('/api/personen/namen')).json || []).some((n) => n.name === TEST))
  const tl = await api(`/api/timeline?p=${encodeURIComponent(TEST)}`)
  ok('Timeline pro Person', sum(tl.json || []) === 1, `${sum(tl.json || [])} Foto`)
  const ff = await api(`/api/faces/${face.sha}`)
  ok('Gesichter des Fotos mit Box + Name', ff.json.faces.some((f) => f.person === TEST && f.box?.length === 4))

  await p.goto(BASE + `/timeline?p=${encodeURIComponent(TEST)}`, { waitUntil: 'networkidle' })
  await p.waitForSelector('main img', { timeout: 20000 })
  await p.locator('main img').first().click()
  await p.waitForSelector('[data-test=faces-bar]', { timeout: 15000 }).catch(() => {})
  ok('Lightbox: Personen-Leiste', (await p.locator(`[data-test=faces-bar] >> text=${TEST}`).count()) > 0)
  await p.keyboard.press('g')
  await p.waitForTimeout(800)
  ok('Lightbox: Gesichter-Rahmen (Taste G)', (await p.locator('[data-test=face-box]').count()) > 0)
  await p.screenshot({ path: `${OUT}_lightbox.png` })
  await p.keyboard.press('g')

  const undo = await post('/api/personen', { actions: [{ mode: 'name_face', sha: face.sha, face: face.face, person: '' }] })
  ok('Testname wieder entfernt', undo.status === 200 && !((await api('/api/personen/namen')).json || []).some((n) => n.name === TEST))
  ok('Ungültige Aktion abgelehnt', (await post('/api/personen', { actions: [{ mode: 'drop_table' }] })).status === 400)
  // gallery#10: Gruppe über den Dialog benennen (kleinste geladene Gruppe), danach wieder entnennen
  const small = per.json.groups[per.json.groups.length - 1]
  await p.goto(BASE + '/personen', { waitUntil: 'networkidle' })
  await p.locator('[data-test=groups] [data-test=benennen]').last().click()
  await p.waitForSelector('[data-test=review] img', { timeout: 30000 })
  await p.click('[data-test=dlg-name]')
  await p.keyboard.type(TEST, { delay: 10 })
  await p.locator('[data-test=review] .grid button').first().click() // eins als „nicht die Person“
  await p.click('[data-test=dlg-save]')
  await p.waitForSelector('[data-test=notice]', { timeout: 60000 }).catch(() => {})
  const note = (await p.locator('[data-test=notice]').textContent().catch(() => '')) || ''
  ok('Dialog: speichern mit Rückmeldung', note.includes(TEST), note.trim())
  ok('Dialog: Name unter „Benannt“', (await p.locator(`[data-test=named] >> text=${TEST}`).count()) > 0)
  await p.screenshot({ path: `${OUT}_gespeichert.png` })
  ok('Name aus Dialog in Filter-Liste', ((await api('/api/personen/namen')).json || []).some((n) => n.name === TEST))
  const undo2 = await post('/api/personen', { actions: [{ mode: 'name', cluster: small.cluster, person: '' }] })
  ok('Dialog-Test zurückgenommen', undo2.status === 200 && !((await api('/api/personen/namen')).json || []).some((n) => n.name === TEST))
  ok('confirm ohne Namen abgelehnt', (await post('/api/personen', { actions: [{ mode: 'confirm', cluster: small.cluster, person: '', wrong: [], shown: [] }] })).status === 400)
  ok('confirm mit kaputten Schlüsseln abgelehnt', (await post('/api/personen', { actions: [{ mode: 'confirm', cluster: small.cluster, person: 'X', wrong: [{ sha: 'x', face: 0 }], shown: [] }] })).status === 400)
  ok('Name mit Komma abgelehnt', (await post('/api/personen', { actions: [{ mode: 'name_face', sha: face.sha, face: face.face, person: 'a,b' }] })).status === 400)
}

ok('keine 5xx/JS-Fehler', errs.length === 0, errs.slice(0, 5).join(' | '))
await b.close()
console.log(fail ? `✗ ${fail} Fehler` : '✅ alles grün')
process.exit(fail ? 1 : 0)
