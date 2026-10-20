"""Frame the app screenshots for the Word report and draw its page backgrounds.

python scripts/report/frames.py   (from web/)
Writes docs/report/figures/frames/*.png and docs/report/figures/bg-*.png.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SHOTS = ROOT / "docs" / "images"
OUT = ROOT / "docs" / "report" / "figures"
FRAMES = OUT / "frames"
FRAMES.mkdir(parents=True, exist_ok=True)

INK = (28, 26, 23)
BORDER = (201, 205, 192)
PAPER = (244, 245, 240)
BOARD = (205, 168, 104)


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return m


def with_shadow(img, pad, blur, offset, alpha):
    """Place an RGBA image on a transparent canvas with a soft shadow under it."""
    w, h = img.size
    canvas = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    a = img.split()[3].point(lambda v: v * alpha // 255)
    s = Image.new("RGBA", img.size, (40, 30, 15, 255))
    s.putalpha(a)
    shadow.paste(s, (pad, pad + offset), s)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(img, (pad, pad))
    return canvas


def phone(name):
    shot = Image.open(SHOTS / f"{name}.jpg").convert("RGB")
    k = 2
    sw, sh = shot.size[0] * k, shot.size[1] * k
    shot = shot.resize((sw, sh), Image.LANCZOS)
    bezel = 22 * k // 2
    body = Image.new("RGBA", (sw + 2 * bezel, sh + 2 * bezel), (0, 0, 0, 0))
    ImageDraw.Draw(body).rounded_rectangle((0, 0, body.size[0] - 1, body.size[1] - 1), 46 * k // 2 + bezel, fill=INK + (255,))
    screen = shot.convert("RGBA")
    screen.putalpha(rounded_mask(screen.size, 40 * k // 2))
    body.alpha_composite(screen, (bezel, bezel))
    framed = with_shadow(body, 36, 14, 10, 110)
    flat(framed, PAPER).save(FRAMES / f"{name}.jpg", quality=86)
    return framed.size


def sheet(name, src=None, radius=10, crop=None, out_name=None):
    path = SHOTS / (src or f"{name}.jpg")
    shot = Image.open(path).convert("RGBA")
    if crop:
        shot = shot.crop(crop)
        shot = shot.resize((shot.size[0] * 3 // 2, shot.size[1] * 3 // 2), Image.LANCZOS)
    name = out_name or name
    w, h = shot.size
    framed = Image.new("RGBA", (w + 4, h + 4), BORDER + (255,))
    framed.alpha_composite(shot, (2, 2))
    framed.putalpha(rounded_mask(framed.size, radius))
    out = with_shadow(framed, 28, 12, 8, 90)
    for bg, suffix in ((PAPER, ""), (BOARD, "-board")) if name in ON_BOARD else ((PAPER, ""),):
        flat(out, bg).save(FRAMES / f"{name}{suffix}.jpg", quality=86)
    return out.size


ON_BOARD = {"desk-storm"}


def flat(img, bg):
    """The report's pages are flat paper (the cover is board), so the shadows can be baked in as JPEG."""
    base = Image.new("RGBA", img.size, bg + (255,))
    base.alpha_composite(img)
    return base.convert("RGB")


def backgrounds():
    # Paper: a flat sheet. Board: the pitch page's grained manila, in faint horizontal streaks.
    Image.new("RGB", (16, 16), PAPER).save(OUT / "bg-paper.png")
    rng = np.random.default_rng(7)
    w, h = 1240, 1754
    rows = rng.normal(0, 1, (h, 1)) * 2.2
    grain = rng.normal(0, 1, (h, w)) * 1.6
    streak = np.repeat(rows, w, axis=1)
    img = np.zeros((h, w, 3))
    for c in range(3):
        img[..., c] = BOARD[c] + streak + grain
    board = Image.fromarray(np.clip(img, 0, 255).astype("uint8"))
    board = board.filter(ImageFilter.BoxBlur(1))
    board.save(OUT / "bg-board.jpg", quality=88)


if __name__ == "__main__":
    backgrounds()
    for n in ["phone-home", "phone-ask", "phone-pulse", "phone-slip", "phone-slip-ledger",
              "phone-slip-marathi", "phone-passport", "lot-passport"]:
        print(n, phone(n))
    for n in ["desk-storm", "desk-storm-brush", "desk-today", "desk-wave", "desk-runs",
              "desk-monsoon", "pitch-ripple", "pitch-hero"]:
        print(n, sheet(n))
    print("kundli-card", sheet("kundli-card", "kundli-card.png", 18))
    # Close-ups for the report's two-up galleries: the part of each screen that tells the story.
    for n, box in {"desk-storm-brush": (0, 300, 840, 880), "desk-monsoon": (560, 90, 1440, 698),
                   "desk-wave": (560, 90, 1440, 698), "desk-runs": (560, 90, 1440, 698),
                   "pitch-ripple": (30, 280, 1410, 660)}.items():
        print(n, "crop", sheet(n, crop=box, out_name=f"{n}-crop"))
