import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const b = await chromium.launch();
for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const p = await b.newPage({ viewport: vp }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${process.env.BASE || 'https://gallery.photonestudios.com'}/t/${process.env.SLUG || 'this-is-mama-lou'}`, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
  await p.waitForTimeout(2500);
  const st = await p.evaluate(() => { const im = [...document.images].filter(i => i.getAttribute('src')); return { imgs: im.length, broken: im.filter(i => i.complete && !i.naturalWidth).length, pending: im.filter(i => !i.complete).length, cover: document.querySelector('.cimg img').naturalWidth, ov: document.documentElement.scrollWidth - innerWidth, title: document.title }; });
  console.log(vp.width, JSON.stringify(st), errs.join('|') || 'no errors');
  await p.screenshot({ path: `${process.env.OUT || '.'}/live_${vp.width}.png` });
  if (vp.width === 1440) {
    const f = p.locator('#relform');
    await p.click('#tickall');
    await f.locator('input[name=name]').fill('TEST Claude (delete me)');
    await f.locator('input[name=email]').fill('test@example.com');
    await f.locator('input[name=signature]').fill('TEST Claude');
    await f.locator('input[name=confirmed]').check();
    await p.click('#relbtn'); await p.waitForSelector('#relok:not([hidden]), #relerr:not([hidden])', { timeout: 20000 });
    console.log('form:', await p.locator('#relok').isVisible() ? 'OK ' + await p.locator('#reloktxt').textContent() : 'ERR ' + await p.locator('#relerr').textContent());
  }
  await p.close();
}
await b.close();
