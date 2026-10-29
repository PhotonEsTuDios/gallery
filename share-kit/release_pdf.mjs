// Usage: node release_pdf.mjs CONSENT_JSON OUT_PDF — one-page copy of a signed release, for both parties.
import { createRequire } from 'module'; import { readFileSync } from 'fs';
const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');
const r = JSON.parse(readFileSync(process.argv[2], 'utf8')); const rel = r.release;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const when = new Date(r.receivedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' }) + ' (Madrid)';
const rows = rel.grants.map(g => `<tr><td class="m">${r.grants[g.k] ? '✓ Yes' : '— No'}</td><td>${esc(g.t)}</td></tr>`).join('');
const html = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=Inter:wght@400;500;600&display=swap">
<style>@page{size:A4;margin:18mm 18mm 16mm} body{font:400 10pt/1.5 Inter,Arial,sans-serif;color:#14110d}
.wm{font-family:'Bodoni Moda',serif;font-size:13pt} .wm em{font-style:normal;color:#5e3f27}
h1{font-family:'Bodoni Moda',serif;font-weight:400;font-size:26pt;line-height:1;margin:14mm 0 2mm} h1 i{color:#5e3f27}
.lbl{font-size:7pt;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#86684c}
table{width:100%;border-collapse:collapse;margin:3mm 0 6mm} td{border-top:.5pt solid #cbbfa9;padding:2mm 0;vertical-align:top} td.m{width:20mm;font-weight:600}
dl{display:grid;grid-template-columns:38mm 1fr;gap:1.5mm 4mm;margin:4mm 0 6mm} dt{color:#86684c} dd{margin:0}
.sig{font-family:'Bodoni Moda',serif;font-style:italic;font-size:16pt} .foot{position:fixed;bottom:0;font-size:7.5pt;color:#86684c}
p{margin:0 0 3mm}</style>
<div class="wm">Photon·<em>Es</em>Tu<em>Di</em>os</div>
<h1>Photo release <i>· ${esc(r.artist)}</i></h1>
<p class="lbl">Session 19 June 2024 · Granada · Photographs by Daniela Haering</p>
<p style="margin-top:6mm">${esc(rel.intro)}</p>
<p class="lbl" style="margin-top:6mm">Uses granted to Photon·EsTuDios</p><table>${rows}</table>
<p>${r.wantsApproval ? '✓ The artist asks to see where an image will be used before it is published.' : 'No approval before publication requested.'}</p>
<p class="lbl" style="margin-top:6mm">Confirmation</p><p>${esc(rel.confirm)}</p>
<dl><dt>Name</dt><dd>${esc(r.name)}</dd><dt>Credit as</dt><dd>${esc(r.creditAs)}</dd><dt>Email</dt><dd>${esc(r.email)}</dd>
<dt>Signed</dt><dd>${when}</dd><dt>Signature (typed)</dt><dd class="sig">${esc(r.signature)}</dd>${r.note ? `<dt>Note</dt><dd>${esc(r.note)}</dd>` : ''}</dl>
<div class="foot">Signed electronically at gallery.photonestudios.com/t/${esc(r.share)} · wording version ${esc(rel.version)} · record ${esc(r.receivedAt)} · IP ${esc(r.ip)}</div>`;
const b = await chromium.launch(); const p = await b.newPage(); await p.setContent(html, { waitUntil: 'networkidle' });
await p.pdf({ path: process.argv[3], format: 'A4', printBackground: true }); await b.close(); console.log('pdf', process.argv[3]);
