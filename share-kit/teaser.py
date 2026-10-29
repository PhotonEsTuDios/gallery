# Usage: teaser.py FRAMES_JSON RELEASE_JSON OUT_HTML MODE(site|artifact) THEME(monograph|noir|archive)
# Three editorial treatments of the same teaser: beige / brown / black, two typefaces each.
# The coda is the usage release: signed here, before the gallery password is sent.
import sys, json, html as H
FR, RJ, OUT, MODE, THEME = sys.argv[1:6]
fr = json.load(open(FR)); F = {r["i"]: r for r in fr}
REL = json.load(open(RJ))
SLUG = "this-is-mama-lou"
fname = lambda i: f"This_is_Mama_Lou_PhotonEsTuDios_SS{i-100:03d}.jpg" if i > 100 else f"This_is_Mama_Lou_PhotonEsTuDios_{i:02d}.jpg"
src = lambda i: ("{{IMG:" + fname(i) + "}}") if MODE == "site" else F[i]["src"]
lab = lambda i: f"S{i-100:03d}" if i > 100 else f"{i:02d}"
APPEAR = []
CIRCLED = {11}  # archive: the editor's grease-pencil selects

def img(i, eager=False, cls=""):
    r = F[i]
    if i not in APPEAR: APPEAR.append(i)
    mark = f'<span class="sel" aria-hidden="true">{lab(i)}</span>' if THEME == "archive" and i in CIRCLED and not eager else ""
    return (f'<figure class="{"l" if r["w"] > r["h"] else "p"} {cls}" style="--ar:{r["w"]/r["h"]:.4f}"><button type="button" class="open" data-i="{i}" aria-label="View frame {lab(i)}">'
            f'<img src="{src(i)}" width="{r["w"]}" height="{r["h"]}" alt="This is Mama Lou, frame {lab(i)}" {"" if eager else "loading=\"lazy\" "}decoding="async"></button>'
            f'<span class="fo">{lab(i)}</span>{mark}</figure>')

def group(ids, k):
    if THEME == "noir" and len(ids) > 1:
        side = "r" if k % 2 else "f"
        return f'<div class="spread {side}">{img(ids[0], cls="big")}<div class="side n{len(ids)-1}">{"".join(img(i) for i in ids[1:])}</div></div>'
    if THEME == "archive":
        return f'<div class="strip"><p class="edge" aria-hidden="true"><span>▸ {lab(ids[0])}{("–" + lab(ids[-1])) if len(ids) > 1 else ""}</span><span>MAMA LOU · NIKON Z 6II</span><span>PHOTON·ESTUDIOS</span></p><div class="row">{"".join(img(i) for i in ids)}</div></div>'
    return f'<div class="row">{"".join(img(i) for i in ids)}</div>'

T = lambda s: ("txt", s)
CH = [
 ("01", "Window Light", "17:51", False, [T('<p class="deck">One evening in Granada, <em>in the shadow of the Alhambra.</em></p>'), [3],
   T('<p class="lead">Mama Lou writes, composes and performs between blues, soul and chanson. Seven looks, one guitar, and an Andalusian evening slowly turning to night.</p>'),
   T('<p class="cap"><b>03</b> Before the first song.</p>')]),
 ("02", "The Balcony", "18:04", False, [[4, 5, 7], [6, 1, 8],
   T('<p class="cap"><b>04–08</b> Wind in the hair, Granada below.</p>')]),
 ("03", "Silver &amp; Stripes", "19:20", True, [T('<p class="sdeck">The look of the night. <em>Sequins, flares and a deck of tarot cards.</em></p>'),
   [159, 175], [11], [167, 170, 173],
   T('<p class="cap"><b>S059–S089</b> From the pouf to the floorboards.</p>'),
   [12, 181],
   T('<p class="cap"><b>11</b> The centre of the edit. <b>12, S081</b> In black and white.</p>')]),
 ("—", None, None, None, [T('<p class="pullq">One evening. Seven looks. <em>One guitar.</em></p>')]),
 ("04", "Red Lace", "19:51", False, [[13, 14], [15, 16], T('<p class="cap"><b>13–16</b> Red lace on the balcony.</p>')]),
 ("05", "Golden Hour", "20:25", False, [[17, 18], T('<p class="cap"><b>17–18</b> The last direct sun.</p>')]),
 ("06", "Blue Hour", "20:49", False, [[19, 20, 21], T('<p class="cap"><b>19–21</b> The guitar comes back out.</p>')]),
 ("07", "The Song", "21:47", True, [[22, 23], T('<p class="cap"><b>22–23</b> Roses and a round mirror. The last song.</p>')]),
]
chap = []
for rom, title, t0, dark, blocks in CH:
    k = 0; body = []
    for b in blocks:
        if isinstance(b, tuple) and ('class="cap"' in b[1] or 'class="sdeck"' in b[1]): continue  # chapter titles only, no captions
        if isinstance(b, tuple): body.append(b[1])
        else: body.append(group(b, k)); k += 1
    if title is None:
        chap.append(f'<section class="pull pad" aria-label="Pull quote">{"".join(body)}</section>'); continue
    inner = "".join(body)
    if rom == "01": inner = f'<div class="feature">{body[1]}<div class="ftext">{body[0]}{body[2]}</div></div>'
    chap.append(f'''<section class="ch pad{" dark" if dark else ""}" aria-label="{title}">
  <header class="rh"><span class="rn">{rom}</span><h2>{title}</h2><span class="rt">{t0}</span></header>
  {inner}
</section>''')

PRIVATE = {2, 9, 10}
APPEAR.insert(0, 182 if THEME == "edition" else 24)
shown = [i for i in APPEAR if i not in PRIVATE]
index = "".join(f'<li><button type="button" class="open" data-i="{i}" aria-label="View frame {lab(i)}"><img data-fill="{i}" alt=""></button><span>{lab(i)}</span></li>' for i in shown)
meta = json.dumps([{"i": i, "t": F[i]["t"], "l": lab(i)} for i in shown])
c = F[182] if THEME == "edition" else F[24]

grants = "".join(f'<label class="check"><input type="checkbox" name="g" value="{g["k"]}"><span>{H.escape(g["t"])}</span></label>' for g in REL["grants"])
release = f'''<section class="release pad dark" id="release" aria-labelledby="relh">
  <header class="rh"><span class="rn">08</span><h2 id="relh">The Release</h2><span class="rt">Before the gallery opens</span></header>
  <div class="rel">
    <div class="relintro">
      <p class="deck">Your gallery is ready. <em>Sign the release to receive your password.</em></p>
      <ol class="steps"><li><b>01</b><span>Sign the release on this page.</span></li><li><b>02</b><span>Daniela confirms and sends your private password.</span></li><li><b>03</b><span>Download the finished edit in full resolution, a press kit and proofs of the whole night.</span></li></ol>
      <p class="small">{H.escape(REL["intro"])}</p>
    </div>
    <form id="relform" class="form" novalidate>
      <fieldset><legend class="lbl">I allow Photon·EsTuDios to use the photographs for</legend>{grants}
        <button type="button" class="link" id="tickall">Tick everything except the private frames</button></fieldset>
      <label class="check"><input type="checkbox" name="wantsApproval"><span>I would like to see where an image will be used before it is published.</span></label>
      <div class="fields">
        <label><span class="lbl">Full name</span><input name="name" autocomplete="name" required></label>
        <label><span class="lbl">Email, for your password</span><input name="email" type="email" autocomplete="email" required></label>
        <label><span class="lbl">Credit me as</span><input name="creditAs" placeholder="This is Mama Lou"></label>
        <label><span class="lbl">Signature: type your full name</span><input name="signature" class="sig" required></label>
        <label class="wide"><span class="lbl">Anything else (optional)</span><textarea name="note" rows="2"></textarea></label>
        <label class="hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      </div>
      <label class="check"><input type="checkbox" name="confirmed" required><span>{H.escape(REL["confirm"])}</span></label>
      <p class="err" id="relerr" role="alert" hidden></p>
      <button type="submit" class="btn" id="relbtn">Sign and send</button>
      <p class="small">Your details are used only for this release and your gallery access, and are never shared. Write to Daniela Haering at any time to see or delete them.</p>
      {'<p class="small">Preview only: the form sends from the live page.</p>' if MODE == "artifact" else ""}
    </form>
    <div class="thanks" id="relok" role="status" hidden><p class="deck">Thank you. <em>Signed and received.</em></p><p class="small" id="reloktxt"></p></div>
  </div>
</section>'''

WM = '<span class="wordmark" aria-label="Photon EsTuDios">Photon<span class="dot">·</span><b><em>Es</em>Tu<em>Di</em>os</b></span>'
COVERS = {
 "monograph": f'''<header class="cover" aria-label="Cover" style="--car:{c["w"]/c["h"]:.4f}">
  <button type="button" class="open cimg" data-i="24" aria-label="View frame 24"><img src="{src(24)}" width="{c["w"]}" height="{c["h"]}" alt="This is Mama Lou with her guitar" fetchpriority="high"></button>
  <div class="cpage"><div class="ctop">{WM}<span class="lbl">Edition 01 · 2026</span></div>
    <div class="cmid"><p class="lbl">Granada · Andalucía</p><h1><i>This is</i>Mama Lou</h1>
    <p class="cdeck">One evening in Granada, city of the Alhambra. Autrice · compositrice · interprète.</p></div>
    <dl class="cfoot"><div><dt>Photographs</dt><dd>Daniela Haering</dd></div><div><dt>Session</dt><dd>Granada · 17:41–21:57</dd></div><div><dt>Frames</dt><dd>{len(shown)}</dd></div></dl></div>
</header>''',
 "noir": f'''<header class="cover" aria-label="Cover">
  <button type="button" class="open cimg" data-i="24" aria-label="View frame 24"><img src="{src(24)}" width="{c["w"]}" height="{c["h"]}" alt="This is Mama Lou with her guitar" fetchpriority="high"></button>
  <p class="vert" aria-hidden="true">Granada · Andalucía · 19.06.2024 · {len(shown)} frames</p>
  <div class="ctop">{WM}<span class="lbl">Edition 01</span></div>
  <div class="ctitle"><p class="lbl">This is</p><h1>Mama <br>Lou</h1><p class="cdeck">Autrice · compositrice · interprète</p></div>
</header>''',
 "edition": f'''<header class="cover" aria-label="Cover">
  <div class="cimg"><button type="button" class="open" data-i="182" aria-label="View the cover photograph"><img src="{src(182)}" width="{c["w"]}" height="{c["h"]}" alt="This is Mama Lou in a sequinned jacket and striped flares, lying on the floor among tarot cards" fetchpriority="high"></button></div>
  <div class="ctop">{WM}<span class="lbl">Granada · 2024</span></div>
  <div class="ctitle"><p class="lbl">This is</p><h1>Mama <br>Lou</h1>
    <dl class="cmeta"><div><dt>Music</dt><dd>Blues · Soul · Chanson</dd></div><div><dt>Photographs</dt><dd>Daniela Haering</dd></div><div><dt>Place</dt><dd>Granada, Andalusia</dd></div></dl></div>
</header>''',
 "archive": f'''<header class="cover" aria-label="Cover">
  <div class="ctop">{WM}<span class="lbl">Contact sheets · Edition 01</span></div>
  <div class="cgrid">
    <div class="print"><p class="edge" aria-hidden="true"><span>▸ 24</span><span>19.06.2024 · 21:57</span></p>{img(24, True)}<span class="crop tl"></span><span class="crop tr"></span><span class="crop bl"></span><span class="crop br"></span></div>
    <div class="ctext"><p class="lbl">Granada · Andalucía</p><h1><i>This is</i> Mama Lou</h1>
      <p class="cdeck">One evening in Granada. Blues, soul and chanson française in the city of the Alhambra.</p>
      <dl class="cfoot"><div><dt>Photographs</dt><dd>Daniela Haering</dd></div><div><dt>Frames</dt><dd>{len(shown)} of 785</dd></div></dl></div>
  </div>
</header>''',
}

FONTS = {
 "monograph": "family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600",
 "noir": "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Space+Mono:wght@400;700",
 "edition": "family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;1,6..96,400&family=Inter:wght@400;500;600",
 "archive": "family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500",
}

BASE = r'''
:root{--paper:#e8dfcf;--paper2:#dacdb6;--ink:#14110d;--brown:#5e3f27;--umber:#86684c;--sand:#c3ae8e;--cream:#efe7d9;--g:8px;
 --bg:var(--paper);--fg:var(--ink);--ac:var(--brown);--mu:var(--umber);--line:color-mix(in srgb,var(--ink) 22%,transparent);color-scheme:light}
*{box-sizing:border-box} html{background:var(--ink)}
body{margin:0;background:var(--bg);color:var(--fg);font:400 16px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
img{max-width:100%} [hidden]{display:none!important}
:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.pad{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
@media (min-width:900px){.pad{padding-left:max(40px,env(safe-area-inset-left,0px));padding-right:max(40px,env(safe-area-inset-right,0px))}}
.dark{--bg:var(--ink);--fg:var(--cream);--ac:var(--sand);--mu:#9d8a70;--line:color-mix(in srgb,var(--cream) 20%,transparent);background:var(--bg);color:var(--fg)}
.ch,.release,.pull,.index,.colo{background:var(--bg);color:var(--fg)}
.wordmark{font-family:var(--serif);letter-spacing:.02em} .wordmark .dot{color:var(--ac);margin:0 .06em} .wordmark b{font-weight:500} .wordmark em{font-style:normal;color:var(--ac)}
.lbl{font-family:var(--sans);font-size:.68rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase}
.open{all:unset;display:block;cursor:zoom-in} .open img{display:block;width:100%;height:auto}
figure{margin:0;position:relative;min-width:0}
.fo{position:absolute;left:8px;bottom:6px;font:500 .6rem/1 var(--sans);letter-spacing:.1em;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);pointer-events:none}
.row{display:flex;gap:var(--g);margin-top:var(--g)} .row figure{flex:var(--ar) 1 0}
@media (max-width:640px){.row{flex-wrap:wrap} .row figure{flex-basis:calc(50% - var(--g)/2)} .row figure:only-child,.row figure.l,.row figure:nth-child(3):last-child{flex-basis:100%}}
.ch{padding-top:44px;padding-bottom:12px}
.rh{display:grid;grid-template-columns:auto 1fr auto;align-items:baseline;gap:16px;border-top:1px solid var(--fg);padding-top:8px;margin-bottom:6px}
.rh h2{margin:0;font-weight:400} .rn,.rt{font-family:var(--sans);font-size:.7rem;letter-spacing:.16em;color:var(--ac)} .rt{color:var(--mu)}
.cap{margin:12px 0 0 auto;max-width:46ch;font-size:.86rem;line-height:1.5;color:var(--mu)}
.cap b{font-weight:600;font-size:.72rem;letter-spacing:.06em;color:var(--ac);margin-right:3px}
@media (min-width:900px){.cap{margin-left:58%}}
.deck{margin:0;font-family:var(--serif);font-weight:400;font-size:clamp(1.8rem,3.4vw,3rem);line-height:1.05;letter-spacing:-.015em;text-wrap:balance} .deck em{color:var(--ac)}
.sdeck{margin:16px 0 6px;max-width:30ch;font-family:var(--serif);font-size:clamp(1.5rem,2.6vw,2.3rem);line-height:1.1} .sdeck em{color:var(--mu)}
.lead{margin:0;max-width:56ch}
.feature{display:grid;gap:var(--g);margin-top:var(--g)} .ftext{display:flex;flex-direction:column;gap:16px;padding-block:8px} .ftext .cap{margin:0}
@media (min-width:900px){.feature{grid-template-columns:minmax(0,6fr) minmax(0,5fr);align-items:end} .ftext{padding:0 0 4px 28px}}
.pull{padding-block:72px 64px;background:var(--paper2)}
.pullby{margin:22px 0 0;text-align:center;color:var(--brown)} .pullq{margin:0 auto;max-width:20ch;text-align:center;font-family:var(--serif);font-size:clamp(2.2rem,5vw,4.6rem);line-height:1;letter-spacing:-.02em} .pullq em{color:var(--brown)}
/* release */
.release{padding-top:56px;padding-bottom:40px}
.rel{display:grid;gap:36px;margin-top:20px} @media (min-width:960px){.rel{grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:56px}}
.relintro{display:flex;flex-direction:column;gap:22px}
.steps{list-style:none;margin:0;padding:0;display:grid;gap:10px} .steps li{display:grid;grid-template-columns:2.4em 1fr;border-top:1px solid var(--line);padding-top:8px}
.steps b{font-size:.72rem;letter-spacing:.1em;color:var(--ac);font-weight:600}
.small{margin:0;font-size:.86rem;color:var(--mu)}
.form{display:grid;gap:20px} fieldset{border:0;margin:0;padding:0;display:grid;gap:10px} legend{margin-bottom:10px;color:var(--ac)}
.check{display:flex;gap:12px;align-items:flex-start;font-size:.92rem;line-height:1.45} .check input{width:17px;height:17px;margin-top:3px;flex:none;accent-color:var(--sand)}
.link{all:unset;cursor:pointer;justify-self:start;font:500 .66rem/1.6 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--ac);border-bottom:1px solid currentColor}
.fields{display:grid;gap:14px} @media (min-width:700px){.fields{grid-template-columns:1fr 1fr} .fields .wide{grid-column:1/-1}}
.fields label{display:grid;gap:6px;min-width:0} .fields .lbl{color:var(--mu)}
input:not([type=checkbox]),textarea{font:inherit;color:var(--fg);background:transparent;border:0;border-bottom:1px solid var(--line);padding:8px 0;border-radius:0;width:100%}
input:not([type=checkbox]):focus,textarea:focus{outline:none;border-bottom-color:var(--ac)}
.sig{font-family:var(--serif);font-style:italic;font-size:1.4rem!important}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.btn{justify-self:start;font:600 .72rem/1 var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--ink);background:var(--cream);border:1px solid var(--cream);padding:16px 26px;cursor:pointer}
.btn:hover{background:var(--sand);border-color:var(--sand)} .btn:disabled{opacity:.5;cursor:default}
.err{margin:0;color:#e0a07a;font-size:.88rem}
.thanks{display:grid;gap:12px;align-content:start}
/* index + colophon */
.index{padding-top:36px} .index ul{list-style:none;margin:10px 0 0;padding:0;display:grid;grid-template-columns:repeat(6,1fr);gap:4px}
@media (min-width:900px){.index ul{grid-template-columns:repeat(15,1fr)}}
.index li{position:relative} .index img{display:block;width:100%;aspect-ratio:2/3;object-fit:cover}
.index span{position:absolute;left:4px;bottom:2px;font:500 .55rem/1 var(--sans);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7)}
.colo{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline;padding-top:28px;padding-bottom:32px;font-size:.84rem}
.colo .wordmark{font-size:1.3rem} .colo a{color:inherit} .colo .credits{color:var(--mu)}
/* lightbox */
.lb{position:fixed;inset:0;z-index:50;background:#0b0a08;color:var(--cream);display:grid;grid-template-rows:auto 1fr auto;padding:calc(env(safe-area-inset-top,0px) + 10px) max(12px,env(safe-area-inset-right,0px)) calc(env(safe-area-inset-bottom,0px) + 10px) max(12px,env(safe-area-inset-left,0px))}
.lb-bar{display:flex;justify-content:space-between;align-items:center;font:500 .7rem var(--sans);letter-spacing:.14em;color:var(--sand)}
.lb-stage{position:relative;min-height:0;overflow:hidden} .lb-stage img{position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}
.lb-nav{display:flex;justify-content:center;gap:8px}
.lb button{font:500 .68rem/1 var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--cream);background:transparent;border:1px solid #4d4234;padding:11px 16px;cursor:pointer} .lb button:hover{border-color:var(--sand);color:var(--sand)}
'''

THEMES = {
# A — the brand pair, quiet and exact: Playfair Display for display, Inter for everything else.
"monograph": r'''
:root{--serif:"Playfair Display",Georgia,serif;--sans:"Inter","Helvetica Neue",Arial,sans-serif}
.cover{display:grid;background:var(--paper);color:var(--ink);min-height:100svh}
.cover .cimg img{display:block;width:100%;height:auto}
.cpage{display:flex;flex-direction:column;justify-content:space-between;gap:32px;padding:24px max(16px,env(safe-area-inset-right,0px)) 24px max(16px,env(safe-area-inset-left,0px))}
.ctop{display:flex;justify-content:space-between;align-items:baseline;gap:12px} .ctop .wordmark{font-size:1.1rem} .ctop .lbl{color:var(--umber)}
.cmid .lbl{color:var(--brown);margin:0 0 18px}
.cover h1{margin:0;font-family:var(--serif);font-weight:400;line-height:.88;letter-spacing:-.03em;font-size:clamp(4rem,min(8.4vw,15vh),9rem)}
.cover h1 i{display:block;font-size:.3em;letter-spacing:0;color:var(--brown);margin-bottom:.25em}
.cdeck{margin:24px 0 0;max-width:36ch;font-size:1.02rem;color:#4a3b2c}
.cfoot{margin:0;display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:8px 36px;border-top:1px solid var(--ink);padding-top:10px}
.cfoot dt{font-size:.62rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--umber)} .cfoot dd{margin:3px 0 0;font-size:.9rem}
@media (min-width:900px){.cover{grid-template-columns:auto minmax(0,1fr);height:clamp(620px,100vh,1100px);min-height:0;overflow:hidden}
 .cover .cimg{height:100%;width:calc(clamp(620px,100vh,1100px) * var(--car))} .cover .cimg img{height:100%;width:100%;object-fit:cover}
 .cpage{padding:32px 44px 32px 56px}}
@media (max-width:899px){.cover .cimg img{max-height:78svh;object-fit:cover;object-position:50% 20%}}
.rh h2{font-family:var(--serif);font-style:italic;font-size:clamp(1.6rem,2.8vw,2.3rem);line-height:1}
.ch.dark{margin-top:44px;padding-bottom:44px}
''',
# B — avant-garde: black ground, Bodoni Moda at poster scale, Space Mono for the machinery.
"noir": r'''
:root{--serif:"Bodoni Moda","Didot","Bodoni 72",serif;--sans:"Space Mono",ui-monospace,Menlo,monospace;--g:10px;--bg:var(--ink);--fg:var(--cream);--ac:var(--sand);--mu:#9d8a70;--line:color-mix(in srgb,var(--cream) 20%,transparent)}
body{font-size:14px;line-height:1.6}
.ch.dark{--bg:var(--paper);--fg:var(--ink);--ac:var(--brown);--mu:var(--umber);--line:color-mix(in srgb,var(--ink) 22%,transparent)}
.cover{position:relative;height:100svh;min-height:560px;overflow:hidden;background:var(--ink);color:var(--paper)}
.cover .cimg,.cover .cimg img{position:absolute;inset:0;width:100%;height:100%} .cover .cimg img{object-fit:cover;object-position:50% 22%;filter:sepia(.18) saturate(.9)}
.cover::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,17,13,.55),rgba(20,17,13,0) 22%,rgba(20,17,13,0) 45%,rgba(20,17,13,.92));pointer-events:none}
.ctop{position:absolute;z-index:2;top:20px;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));display:flex;justify-content:space-between;pointer-events:none} .ctop .wordmark{font-size:1.05rem}
.vert{white-space:nowrap;position:absolute;z-index:2;right:max(12px,env(safe-area-inset-right,0px));top:50%;margin:0;writing-mode:vertical-rl;transform:translateY(-50%);font:400 .62rem var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--sand);pointer-events:none}
.ctitle{position:absolute;z-index:2;left:max(12px,env(safe-area-inset-left,0px));right:0;bottom:12px;pointer-events:none}
.ctitle .lbl{margin:0 0 0 .4em;color:var(--sand)}
.cover h1{margin:0;font-family:var(--serif);font-weight:400;line-height:.78;letter-spacing:-.05em;font-size:clamp(5rem,24vw,22rem);text-transform:uppercase}
.cdeck{margin:14px 0 0 .4em;font:400 .72rem var(--sans);letter-spacing:.12em;text-transform:uppercase;color:var(--sand)}
@media (min-width:900px){.cover h1{font-size:min(16vw,34vh)} .cover h1 br{display:none}
 .cover .cimg{left:auto;width:min(100%,calc(100svh * .665))} .cover .cimg img{filter:sepia(.18) saturate(.9)}
 .cover::after{background:linear-gradient(90deg,var(--ink) 0,var(--ink) calc(100% - 100svh * .665),rgba(20,17,13,.2) calc(100% - 100svh * .665 + 140px),rgba(20,17,13,0) 70%),linear-gradient(180deg,rgba(20,17,13,0) 55%,rgba(20,17,13,.85))}
 .vert{right:auto;left:max(16px,env(safe-area-inset-left,0px));top:96px;transform:rotate(180deg)}}
.rh{grid-template-columns:auto 1fr auto;border-top:0;padding-top:0;align-items:end}
.rn{font-family:var(--serif);font-size:clamp(4.5rem,11vw,9rem);line-height:.8;letter-spacing:-.04em;color:transparent;-webkit-text-stroke:1px var(--ac)}
.rh h2{font:700 .8rem/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;border-bottom:1px solid var(--fg);padding-bottom:8px}
.rt{padding-bottom:8px}
.spread{display:grid;gap:var(--g);margin-top:var(--g);align-items:end}
.spread .side{display:grid;gap:var(--g);grid-template-columns:1fr 1fr} .spread .side.n1{grid-template-columns:1fr}
@media (min-width:760px){.spread{grid-template-columns:minmax(0,7fr) minmax(0,5fr)} .spread.r{grid-template-columns:minmax(0,5fr) minmax(0,7fr)} .spread.r .big{order:2}
 .spread .side.n1{width:82%} .spread.r .side.n1{justify-self:end}}
.cap{font-size:.78rem} .cap b{font-weight:700}
.deck,.sdeck{letter-spacing:-.025em} .deck{font-size:clamp(2rem,4vw,3.6rem)}
.pull{background:var(--paper);color:var(--ink)} .pullby{text-align:left} .pullq{text-align:left;max-width:16ch;margin:0;font-size:clamp(2.6rem,7vw,7rem);line-height:.92;letter-spacing:-.04em}
.release.dark{--bg:var(--ink)} .btn{font-weight:700}
''',
# D — the edition: Noir's cover mood, Monograph's pages. Bodoni Moda + Inter.
"edition": r'''
:root{--serif:"Bodoni Moda","Didot","Bodoni 72",serif;--sans:"Inter","Helvetica Neue",Arial,sans-serif}
/* cover: one landscape frame, full bleed; type sits on the floorboards, never on her face */
.cover{position:relative;height:100svh;min-height:560px;max-height:1200px;overflow:hidden;background:var(--ink);color:var(--paper);--ac:var(--sand)}
.cimg{position:absolute;inset:0} .cimg .open,.cimg img{width:100%;height:100%} .cimg img{object-fit:cover;object-position:52% 30%}
.cover::after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(20,17,13,.5) 0,rgba(20,17,13,0) 16%,rgba(20,17,13,0) 50%,rgba(20,17,13,.55) 70%,rgba(20,17,13,.94) 100%)}
.ctop{position:absolute;z-index:2;top:22px;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));display:flex;justify-content:space-between;align-items:baseline;pointer-events:none}
.ctop .wordmark{font-size:1.1rem} .ctop .lbl{color:var(--paper)}
.ctitle{position:absolute;z-index:2;left:max(16px,env(safe-area-inset-left,0px));right:max(16px,env(safe-area-inset-right,0px));bottom:max(18px,env(safe-area-inset-bottom,0px));pointer-events:none}
.ctitle .lbl{margin:0 0 6px .3em;color:var(--sand)}
.cover h1{margin:0 0 0 -.04em;font-family:var(--serif);font-weight:400;line-height:.8;letter-spacing:-.045em;font-size:clamp(4.6rem,25vw,22rem);text-transform:uppercase}
.cmeta{margin:18px 0 0;padding-top:10px;border-top:1px solid rgba(239,231,217,.35);display:grid;grid-template-columns:1fr 1fr;gap:10px 24px}
.cmeta dt{font:500 .58rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--sand)} .cmeta dd{margin:5px 0 0;font-size:.84rem;color:var(--paper)}
.cmeta div:last-child{display:none}
@media (max-width:899px){.cimg img{object-position:50% 50%}}
@media (min-width:900px){
 .ctop{left:48px;right:48px} .ctitle{left:48px;right:48px;bottom:34px}
 .cover h1{font-size:min(15vw,30vh)} .cover h1 br{display:none}
 .cmeta{grid-template-columns:repeat(3,minmax(0,16rem));margin-top:22px} .cmeta div:last-child{display:block}}
/* pages: one left edge, titles in Bodoni italic, everything else Inter */
.rh{grid-template-columns:2.6rem 1fr} .rt{display:none}
.rh h2{font-family:var(--serif);font-style:italic;font-size:clamp(1.7rem,3vw,2.5rem);line-height:1}
.ch{padding-top:56px} .ch.dark{margin-top:56px;padding-bottom:56px}
.deck,.pullq{letter-spacing:-.02em}
.feature .deck{font-size:clamp(2rem,3.6vw,3.3rem)} .lead{font-size:1.02rem;max-width:44ch}
.ftext::before{content:"Granada, Andalusia";font:500 .66rem/1 var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--brown)}
.pull{padding-block:96px 88px}
''',
# C — the contact sheet: kraft-beige sheets, film strips, grease-pencil selects. Instrument Serif + JetBrains Mono.
"archive": r'''
:root{--serif:"Instrument Serif",Georgia,serif;--sans:"JetBrains Mono",ui-monospace,Menlo,monospace;--paper:#ddd0b8;--paper2:#cfbf a3;--g:6px}
:root{--paper2:#cdbd9f}
body{font-size:14px;line-height:1.6;background-image:radial-gradient(color-mix(in srgb,var(--ink) 5%,transparent) 1px,transparent 1px);background-size:4px 4px}
.cover{padding:20px max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px));min-height:100svh;display:flex;flex-direction:column;gap:28px}
@media (min-width:900px){.cover{padding-left:40px;padding-right:40px}}
.ctop{display:flex;justify-content:space-between;align-items:baseline} .ctop .wordmark{font-size:1.25rem} .ctop .lbl{color:var(--umber)}
.cgrid{display:grid;gap:32px;align-items:end;flex:1}
@media (min-width:900px){.cgrid{grid-template-columns:minmax(0,auto) minmax(0,1fr);gap:56px} .print{height:min(78vh,900px);aspect-ratio:var(--par)} .print figure,.print .open,.print img{height:100%;width:auto}}
.print{position:relative;background:var(--ink);padding:26px 14px 14px;justify-self:start;--par:.69}
.print .edge{position:absolute;top:6px;left:14px;right:14px;margin:0;display:flex;justify-content:space-between;font:500 .6rem var(--sans);letter-spacing:.14em;color:#d7a54a}
.crop{position:absolute;width:18px;height:18px;border:0 solid var(--ink)} .crop.tl{top:-12px;left:-12px;border-width:1px 0 0 1px} .crop.tr{top:-12px;right:-12px;border-width:1px 1px 0 0} .crop.bl{bottom:-12px;left:-12px;border-width:0 0 1px 1px} .crop.br{bottom:-12px;right:-12px;border-width:0 1px 1px 0}
.ctext .lbl{color:var(--brown);margin:0 0 10px}
.cover h1{margin:0;font-family:var(--serif);font-weight:400;font-size:clamp(4.4rem,11vw,11rem);line-height:.84;letter-spacing:-.025em}
.cover h1 i{display:block;color:var(--brown);font-size:.5em;line-height:1}
.cdeck{margin:22px 0 26px;max-width:34ch;font-family:var(--serif);font-size:1.5rem;line-height:1.2}
.cfoot{margin:0;display:flex;gap:40px;border-top:1px solid var(--ink);padding-top:10px} .cfoot dt{font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;color:var(--umber)} .cfoot dd{margin:3px 0 0}
.rh h2{font-family:var(--serif);font-size:clamp(2rem,4vw,3.4rem);line-height:.9}
.strip{background:var(--ink);padding:0 8px 8px;margin-top:14px}
.strip .edge{margin:0;display:flex;justify-content:space-between;gap:12px;padding:6px 2px 0;font:500 .58rem var(--sans);letter-spacing:.16em;color:#d7a54a;white-space:nowrap;overflow:hidden}
.strip .edge span:nth-child(2){flex:1;text-align:center} @media (max-width:640px){.strip .edge span:nth-child(3){display:none}}
.strip .row{margin-top:6px}
.fo{color:#d7a54a;text-shadow:none;top:-1px;bottom:auto;left:auto;right:4px;transform:translateY(-100%);display:none}
.sel{position:absolute;top:10px;right:12px;display:grid;place-items:center;width:3.2em;height:2.4em;font:500 .8rem var(--sans);color:#f3d9b0;border:2px solid #c0602f;border-radius:50% 46% 52% 44%/48% 54% 44% 52%;transform:rotate(-8deg);pointer-events:none}
.sel::after{content:"★ select";position:absolute;left:110%;white-space:nowrap;font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:#f3d9b0;transform:rotate(8deg)}
.sel{right:auto;left:12px}
.ch.dark{--bg:var(--paper2);--fg:var(--ink);--ac:var(--brown);--mu:var(--umber);--line:color-mix(in srgb,var(--ink) 22%,transparent)}
.ch.dark .rh h2::after{content:" ★";color:#b5562b;font-size:.6em;vertical-align:.3em}
.deck,.sdeck,.pullq{letter-spacing:-.01em} .cap{font-size:.78rem}
.pullq{font-style:italic}
.release.dark .sig{font-size:1.7rem!important}
''',
}

css = BASE + THEMES[THEME]
title_v = {"edition": "Edition", "monograph": "Monograph", "noir": "Noir", "archive": "Contact Sheet"}[THEME]
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>This is Mama Lou · Photon·EsTuDios</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?{FONTS[THEME]}&display=swap">
<style>{css}</style></head><body class="t-{THEME}">
{COVERS[THEME]}
<main>
{"".join(chap)}
{release}
  <section class="index pad dark" aria-label="Index"><p class="lbl" style="color:var(--mu)">Index · {len(shown)} frames</p><ul>{index}</ul></section>
  <footer class="colo pad dark">{WM}<span class="credits">This is Mama Lou · photography, direction &amp; edit Daniela Haering · Granada</span><a class="lbl" href="https://photonestudios.com" target="_blank" rel="noopener">photonestudios.com</a></footer>
</main>
<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Full screen viewer">
  <div class="lb-bar"><span id="lbInfo"></span><button type="button" id="lbClose">Close</button></div>
  <div class="lb-stage"><img id="lbImg" alt=""></div>
  <div class="lb-nav"><button type="button" id="lbPrev">← Prev</button><button type="button" id="lbNext">Next →</button></div>
</div>
<script>
(() => {{
  const META = {meta}, LIVE = {"true" if MODE == "site" else "false"}, SLUG = "{SLUG}";
  const srcs = {{}}; document.querySelectorAll(".open img[src]").forEach(im => {{ const i = im.closest(".open").dataset.i; if (!srcs[i]) srcs[i] = im.getAttribute("src"); }});
  document.querySelectorAll("img[data-fill]").forEach(im => im.src = srcs[im.dataset.fill]);
  const lb = document.getElementById("lb"), li = document.getElementById("lbImg"), info = document.getElementById("lbInfo"); let idx = 0, last = null;
  const show = k => {{ idx = (k + META.length) % META.length; const m = META[idx]; li.src = srcs[m.i]; li.alt = "This is Mama Lou, frame " + m.l; info.textContent = "№ " + m.l + " · " + m.t; }};
  const open = i => {{ last = document.activeElement; show(Math.max(0, META.findIndex(m => m.i === i))); lb.hidden = false; document.body.style.overflow = "hidden"; document.getElementById("lbClose").focus(); }};
  const close = () => {{ lb.hidden = true; document.body.style.overflow = ""; last && last.focus(); }};
  document.querySelectorAll(".open").forEach(b => b.addEventListener("click", () => open(+b.dataset.i)));
  document.getElementById("lbClose").onclick = close; document.getElementById("lbPrev").onclick = () => show(idx - 1); document.getElementById("lbNext").onclick = () => show(idx + 1);
  addEventListener("keydown", e => {{ if (lb.hidden) return; if (e.key === "Escape") close(); else if (e.key === "ArrowRight") show(idx + 1); else if (e.key === "ArrowLeft") show(idx - 1); }});
  let x0 = null; lb.addEventListener("touchstart", e => x0 = e.touches[0].clientX, {{ passive: true }});
  lb.addEventListener("touchend", e => {{ if (x0 === null) return; const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 40) show(idx + (d < 0 ? 1 : -1)); x0 = null; }});

  // release form
  const f = document.getElementById("relform"), err = document.getElementById("relerr"), btn = document.getElementById("relbtn");
  const done = at => {{ f.hidden = true; document.getElementById("relok").hidden = false;
    document.getElementById("reloktxt").textContent = "Received " + new Date(at).toLocaleString("en-GB") + ". Daniela will send your password to the email you gave."; }};
  try {{ const at = localStorage.getItem("release-" + SLUG); if (at) done(at); }} catch (e) {{}}
  document.getElementById("tickall").onclick = () => f.querySelectorAll('input[name=g]').forEach(c => {{ if (c.value !== "privateFrames") c.checked = true; }});
  const hex = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
  f.addEventListener("submit", async e => {{
    e.preventDefault(); err.hidden = true;
    const v = n => (f.elements[n].value || "").trim();
    if (!v("name") || !v("signature") || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v("email")) || !f.elements.confirmed.checked) {{
      err.textContent = "Please add your name, email and signature, and tick the confirmation."; err.hidden = false; return; }}
    if (!LIVE) {{ err.textContent = "This is the preview. The form sends from the live page."; err.hidden = false; return; }}
    const grants = {{}}; f.querySelectorAll('input[name=g]').forEach(c => grants[c.value] = c.checked);
    const body = JSON.stringify({{ name: v("name"), email: v("email"), creditAs: v("creditAs"), signature: v("signature"), note: v("note"), website: v("website"),
      wantsApproval: f.elements.wantsApproval.checked, confirmed: true, grants }});
    btn.disabled = true; btn.textContent = "Sending…";
    try {{
      const r = await fetch("/api/share/" + SLUG + "/release", {{ method: "POST", headers: {{ "content-type": "application/json", "x-amz-content-sha256": await hex(body) }}, body }});
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(); try {{ localStorage.setItem("release-" + SLUG, j.receivedAt); }} catch (e) {{}} done(j.receivedAt);
    }} catch (x) {{ err.textContent = "Sending did not work. Please try again in a moment."; err.hidden = false; btn.disabled = false; btn.textContent = "Sign and send"; }}
  }});
}})();
</script>
</body></html>
'''
if THEME == "archive":
    page = page.replace("--par:.69", f"--par:{(c['w']+28)/(c['h']+40):.4f}")
if MODE == "artifact":
    head = page.split("<head>", 1)[1].split("</head>", 1)[0]
    head = "\n".join(l for l in head.splitlines() if not l.startswith("<meta charset") and 'name="robots"' not in l)
    head = head.replace("<title>This is Mama Lou · Photon·EsTuDios</title>", f"<title>Mama Lou · {title_v}</title>")
    page = head + page.split("<body", 1)[1].split(">", 1)[1].rsplit("</body>", 1)[0]
if MODE == "artifact":  # no charset meta in artifact mode: keep the markup pure ASCII so no viewer can mis-guess it
    import re
    page = re.sub(r"(<script>.*?</script>)|([^<]+|<)", lambda m: m.group(1).encode("ascii", "backslashreplace").decode() if m.group(1) else m.group(2).encode("ascii", "xmlcharrefreplace").decode(), page, flags=re.S)
open(OUT, "w").write(page); print(THEME, MODE, round(len(page) / 1e6, 2), "MB")
