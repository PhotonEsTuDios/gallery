# Usage: grade.py IN_JPG OUT_JPG [preset]
# Editorial red-cast correction: partial WB in linear light, selective red/orange HSL, filmic curve, gentle split-tone.
import sys, numpy as np
from PIL import Image, ImageOps, ImageFilter

def srgb_to_lin(x): return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
def lin_to_srgb(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, 12.92 * x, 1.055 * x ** (1 / 2.4) - 0.055)

def rgb_to_hsv(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mx = c.max(-1); mn = c.min(-1); d = mx - mn + 1e-8
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-8), 0); return h, s, mx
def hsv_to_rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    out = np.choose(i[..., None].repeat(3, -1), [np.stack(x, -1) for x in
          [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]])
    return out

P = dict(
    wb_strength=0.50,      # share of the measured cast removed globally (keep some evening warmth)
    tint_green=0.03,       # magenta→green tint correction
    red_hue_shift=0.010,   # rotate reds toward orange (fraction of the hue circle, ~8°)
    red_sat=0.76,          # saturation multiplier in the red/orange band
    red_lum=1.02,          # luminance lift in that band (skin opens up)
    contrast=0.30, black_lift=0.010, highlight_roll=0.92,
    shadow_tint=(-0.006, 0.002, 0.010), high_tint=(0.010, 0.004, -0.008),  # cool shadows, cream highlights
    global_sat=1.0, denoise=1,
)

def grade(img, P):
    a = np.asarray(img, dtype=np.float32) / 255.0
    if P["denoise"]:  # ISO 28800: light chroma denoise only, keep luminance detail
        ycc = img.convert("YCbCr"); y, cb, cr = ycc.split()
        cb = cb.filter(ImageFilter.GaussianBlur(1.6)); cr = cr.filter(ImageFilter.GaussianBlur(1.6))
        a = np.asarray(Image.merge("YCbCr", (y, cb, cr)).convert("RGB"), dtype=np.float32) / 255.0
    lin = srgb_to_lin(a)
    # 1) white balance: estimate cast on mid-tone pixels weighted toward low chroma (bright neutrals + skin compromise)
    lum = lin.mean(-1); m = (lum > 0.05) & (lum < 0.85)
    avg = lin[m].mean(0); gains = avg[1] / avg  # gray-world gains
    gains = 1 + (gains - 1) * P["wb_strength"]; gains[1] *= 1 + P["tint_green"] * 0.5; gains /= gains[1]
    lin = lin * gains
    # exposure normalise so mid-grey stays put
    lin *= (avg.mean() / (lin[m].mean() + 1e-8)) ** 0.5
    c = lin_to_srgb(lin)
    # 2) selective red/orange band (hue 340°..40°)
    h, s, v = rgb_to_hsv(c)
    dist = np.minimum(np.abs(h - 0.03), 1 - np.abs(h - 0.03))       # centred ~11°
    w = np.clip(1 - dist / 0.10, 0, 1) ** 1.5 * np.clip(s / 0.25, 0, 1)
    h = (h + P["red_hue_shift"] * w) % 1
    s = s * (1 - w * (1 - P["red_sat"])) * P["global_sat"]
    v = np.clip(v * (1 + w * (P["red_lum"] - 1)), 0, 1)
    c = hsv_to_rgb(h, s, v)
    # 3) tone curve: soft S around 0.45, lifted blacks, rolled highlights
    k = P["contrast"]; x = c
    x = x + k * (x - 0.45) * (1 - np.abs(2 * x - 1)) * 1.4
    x = P["black_lift"] + (1 - P["black_lift"]) * x
    x = np.where(x > 0.8, 0.8 + (x - 0.8) * P["highlight_roll"], x)
    # 4) split tone by luminance
    L = x.mean(-1, keepdims=True)
    x = x + np.array(P["shadow_tint"]) * (1 - L) ** 2 + np.array(P["high_tint"]) * L ** 2
    return Image.fromarray((np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8))

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    res = grade(img, P); res.save(out, quality=92, subsampling=0)
    a = np.asarray(res, dtype=np.float32); H, W, _ = a.shape
    for name, (x0, y0, x1, y1) in {"curtain": (0.93, .1, 1, .5), "face": (.4, .12, .6, .28)}.items():
        r = a[int(y0*H):int(y1*H), int(x0*W):int(x1*W)].reshape(-1, 3).mean(0)
        print(name, r.round(1), "R/G %.2f B/G %.2f" % (r[0]/r[1], r[2]/r[1]))
