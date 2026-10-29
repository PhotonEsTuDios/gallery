// Usage: SHARE_PW=… [BASE=…] [SLUG=…] [OUT=prefix] [CONSENT=1] node share-kit/share_e2e.mjs
// Ende-zu-Ende: Teaser → Passwort-Gate (falsch/richtig) → Galerie → Downloads/Picks.
import { createRequire } from 'module'; const { chromium } = createRequire(new URL('../package.json', import.meta.url))('playwright')
const BASE = process.env.BASE || 'https://gallery.photonestudios.com', PW = process.env.SHARE_PW, OUT = process.env.OUT || './share', CONSENT = process.env.CONSENT === '1'
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url().slice(0, 120)) })
await p.goto(BASE + '/t/' + (process.env.SLUG || 'this-is-mama-lou'), { waitUntil: 'networkidle' })
const tImgs = await p.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth).length)
console.log('teaser images loaded', tImgs); await p.screenshot({ path: OUT + '_teaser.png' })
const href = await p.getAttribute('a.cta', 'href'); console.log('cta', href)
await p.goto(BASE + href, { waitUntil: 'networkidle' }); await p.screenshot({ path: OUT + '_gate.png' })
await p.fill('#pw', 'wrong-password'); await p.click('button[type=submit]'); await p.waitForTimeout(1500)
console.log('wrong pw error shown', await p.isVisible('.err'))
// restore expected 401 from the wrong attempt in the error list
await p.fill('#pw', PW); await p.click('button[type=submit]'); await p.waitForSelector('.masonry img', { timeout: 20000 })
await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)) } scrollTo(0, 0) })
await p.waitForTimeout(1500)
const g = await p.evaluate(() => ({ hero: document.querySelectorAll('.masonry img').length, heroOk: [...document.querySelectorAll('.masonry img')].filter(i => i.complete && i.naturalWidth).length,
  proofs: document.querySelectorAll('.proof img').length, proofOk: [...document.querySelectorAll('.proof img')].filter(i => i.complete && i.naturalWidth).length, zips: document.querySelectorAll('.zips a').length, nav: !!document.querySelector('nav') }))
console.log('gallery', JSON.stringify(g)); await p.screenshot({ path: OUT + '_gallery.png' })
const zipUrl = await p.getAttribute('.zips a', 'href'); const zr = await ctx.request.fetch(zipUrl, { method: 'HEAD' })
console.log('zip HEAD', zr.status(), zr.headers()['content-length'], zr.headers()['content-disposition'])
const main = await ctx.request.get(BASE + '/api/albums'); console.log('main gallery with share cookie', main.status())
await p.click('.masonry .open >> nth=2'); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '_lightbox.png' }); await p.keyboard.press('Escape')
await p.click('.proof >> nth=4'); await p.click('.proof >> nth=40')
if (CONSENT) {
  await p.locator('.form').scrollIntoViewIfNeeded()
  await p.click('.link'); await p.fill('input[autocomplete=name]', 'TEST Claude – please delete'); await p.fill('.sig', 'TEST Claude')
  await p.check('.form > label.check:last-of-type input'); await p.screenshot({ path: OUT + '_form.png', fullPage: false })
  await p.click('.btn.big'); await p.waitForSelector('.thanks', { timeout: 15000 }); console.log('consent thanks shown')
}
console.log('errors', errs.filter(e => !e.includes('/login'))); await b.close()
