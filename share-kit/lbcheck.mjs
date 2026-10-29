import { createRequire } from 'module';
const require = createRequire(new URL('../package.json', import.meta.url));
const { webkit, chromium } = require('playwright');
for (const [name, eng] of [['webkit', webkit], ['chromium', chromium]]) {
  let b; try { b = await eng.launch(); } catch (e) { console.log(name, 'n/a'); continue; }
  for (const vp of [{width:1440,height:900},{width:390,height:844}]) {
    const p = await b.newPage({ viewport: vp });
    await p.goto(process.argv[2], { waitUntil: 'networkidle' });
    const opens = process.argv[4] ? await p.$$(`.open[data-i="${process.argv[4]}"]`) : await p.$$(".open");
    await opens[+(process.argv[3]||3)].click(); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const i = document.getElementById('lbImg'), s = i.parentElement.getBoundingClientRect(), b = i.getBoundingClientRect(); return { nat: [i.naturalWidth, i.naturalHeight], img: [Math.round(b.top), Math.round(b.bottom), Math.round(b.width), Math.round(b.height)], stage: [Math.round(s.top), Math.round(s.bottom)], vh: innerHeight }; });
    console.log(name, vp.width, JSON.stringify(r));
    await p.screenshot({ path: `${process.env.OUT || '.'}/lb_${name}_${vp.width}.png` });
    await p.close();
  }
  await b.close();
}
