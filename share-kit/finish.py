# Usage: finish.py SRC_DIR OUT_DIR   — house finish for every pick, adaptive red-cast correction
import sys, os, json, copy, numpy as np
from concurrent.futures import ProcessPoolExecutor
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(__file__)); import grade as G

def analyse(img):
    a = np.asarray(img.resize((300, int(300 * img.height / img.width))), dtype=np.float32)
    m = a.reshape(-1, 3); l = m.mean(1); mid = m[(l > 40) & (l < 230)]
    chroma = np.abs(m[:, 0] - m[:, 1]).mean() + np.abs(m[:, 2] - m[:, 1]).mean()
    rg = mid[:, 0].mean() / max(mid[:, 1].mean(), 1)
    return rg, chroma

def work(args):
    src, dst = args
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    rg, chroma = analyse(img)
    P = copy.deepcopy(G.P)
    if chroma < 6:   # black-and-white frame: tone only, stay neutral
        P.update(wb_strength=0, tint_green=0, red_hue_shift=0, red_sat=1, red_lum=1, global_sat=1,
                 shadow_tint=(0, 0, 0), high_tint=(0, 0, 0), denoise=0)
        kind = "bw"
    else:
        cast = float(np.clip((rg - 1.30) / (2.0 - 1.30), 0, 1))   # 0 = normal warm, 1 = heavy red lamp
        P.update(wb_strength=0.12 + 0.40 * cast, red_sat=0.94 - 0.18 * cast, red_hue_shift=0.004 + 0.008 * cast,
                 tint_green=0.01 + 0.02 * cast, denoise=1 if cast > 0.3 else 0)
        kind = "red" if cast > 0.3 else "colour"
    out = G.grade(img, P)
    out.save(dst, quality=95, subsampling=0, icc_profile=None)
    return os.path.basename(dst), kind, round(float(rg), 2)

if __name__ == "__main__":
    S, O = sys.argv[1:3]; os.makedirs(O, exist_ok=True)
    jobs = [(f"{S}/{f}", f"{O}/{f}") for f in sorted(os.listdir(S)) if f.endswith(".jpg")]
    with ProcessPoolExecutor() as ex: res = list(ex.map(work, jobs))
    json.dump(res, open(f"{O}/../finish_log.json", "w"))
    from collections import Counter; print(len(res), Counter(k for _, k, _ in res))
