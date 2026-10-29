# Usage: release.py GRADED_DIR OUT_DIR
import sys, os, shutil, numpy as np
from PIL import Image, ImageDraw, ImageFont
G, O = sys.argv[1:3]
H = [42,13,8,22,27,30,34,43,51,52,86,78,100,97,109,112,123,121,128,131,133,137,140,143]
PRIVATE = {8, 51, 52}          # implied nudity: artist approval before any public use; not in press kit
fs = {int(f[:3]): f for f in os.listdir(G) if f.endswith(".jpg")}
dirs = {k: f"{O}/{v}" for k, v in dict(hero="01 Hero Edit (24)", hi="02 Press Kit/High-res", web="02 Press Kit/Web 2048",
        ig="02 Press Kit/Instagram 4x5", st="02 Press Kit/Stories 9x16", ban="02 Press Kit/Banner", proof="03 Proofs – all 143 (graded, web)").items()}
for d in dirs.values(): os.makedirs(d, exist_ok=True)

def subject_x(im):
    g = np.asarray(im.convert("L").resize((200, int(200 * im.height / im.width))), dtype=np.float32)
    lap = np.abs(4*g[1:-1,1:-1]-g[:-2,1:-1]-g[2:,1:-1]-g[1:-1,:-2]-g[1:-1,2:])
    col = lap.sum(0); col = np.convolve(col, np.ones(15)/15, "same")
    return (np.argmax(col) + 1) / g.shape[1]

def crop_ratio(im, rw, rh, top_bias=0.25):
    W, Hh = im.size; tr = rw / rh
    if W / Hh > tr:   # too wide → crop width around subject
        nw = int(Hh * tr); cx = subject_x(im) * W; x0 = int(min(max(cx - nw/2, 0), W - nw)); return im.crop((x0, 0, x0 + nw, Hh))
    nh = int(W / tr); y0 = int((Hh - nh) * top_bias); return im.crop((0, y0, W, y0 + nh))

for i, n in enumerate(H, 1):
    im = Image.open(f"{G}/{fs[n]}"); base = f"MamaLou_PhotonEsTuDios_{i:02d}"
    im.save(f"{dirs['hero']}/{base}.jpg", quality=95, subsampling=0)
    if n in PRIVATE: continue
    im.save(f"{dirs['hi']}/{base}.jpg", quality=95, subsampling=0)
    w = im.copy(); w.thumbnail((2048, 2048), Image.LANCZOS); w.save(f"{dirs['web']}/{base}_web.jpg", quality=86, optimize=True, progressive=True)
    if im.height >= im.width:
        crop_ratio(im, 4, 5).resize((1080, 1350), Image.LANCZOS).save(f"{dirs['ig']}/{base}_4x5.jpg", quality=90)
        crop_ratio(im, 9, 16).resize((1080, 1920), Image.LANCZOS).save(f"{dirs['st']}/{base}_9x16.jpg", quality=90)
    else:
        crop_ratio(im, 4, 5).resize((1080, 1350), Image.LANCZOS).save(f"{dirs['ig']}/{base}_4x5.jpg", quality=90)
        b = crop_ratio(im, 16, 9, 0.4); b.save(f"{dirs['ban']}/{base}_16x9.jpg", quality=92)
        crop_ratio(im, 3, 1, 0.35).save(f"{dirs['ban']}/{base}_3x1.jpg", quality=92)

font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 26)
for f in sorted(fs.values()):
    im = Image.open(f"{G}/{f}"); im.thumbnail((1600, 1600), Image.LANCZOS); d = ImageDraw.Draw(im)
    txt = f"PROOF {f[:3]} · Photon·EsTuDios"; tw = d.textlength(txt, font=font)
    d.text((im.width - tw - 24, im.height - 44), txt, font=font, fill=(255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0))
    im.save(f"{dirs['proof']}/Proof_{f}", quality=82, optimize=True, progressive=True)
for k, d in dirs.items(): print(f"{len(os.listdir(d)):4d}  {os.path.relpath(d, O)}")
