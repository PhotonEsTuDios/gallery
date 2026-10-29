// Usage: BASE=… SHARE_PW=… node share-kit/zip_check.mjs  — lädt die ersten Bytes jeder Zip-Datei eines Shares (presigned GET)
import { createRequire } from 'module'; const { chromium } = createRequire(new URL('../package.json', import.meta.url))('playwright')
const BASE = process.env.BASE; const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
await p.goto(BASE + '/s/this-is-mama-lou'); await p.fill('#pw', process.env.SHARE_PW); await p.click('button[type=submit]'); await p.waitForSelector('.zips a')
for (const a of await p.$$('.zips a')) { const u = await a.getAttribute('href'); const r = await ctx.request.get(u, { headers: { Range: 'bytes=0-3' } }); const body = await r.body()
  console.log(r.status(), r.headers()['content-range'], body.slice(0, 2).toString() === 'PK' ? 'ZIP ok' : 'kein ZIP', new URL(u).hostname) }
await b.close()
