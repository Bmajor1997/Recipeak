"""Draws the Recipeek icon: the camera button's citrus ring with a serif R inside, on near-black.

Run from the repo root (needs Pillow and the app's node_modules for the Fraunces font):
    python3 scripts/make_app_icon.py
It rewrites the icon, Android adaptive icon, splash and favicon in apps/mobile/assets, and assets/app-icon.png.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = str(ROOT / "apps/mobile/node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf")
OUT = ROOT / "apps/mobile/assets"
BG = (15, 15, 16)
INNER = (26, 26, 28)
STOPS = [(0.0, (255, 111, 97)), (0.5, (255, 179, 71)), (1.0, (255, 61, 110))]  # same as the camera button


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size):
    """Diagonal gradient, top-left to bottom-right, like the camera button's LinearGradient."""
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            for (p0, c0), (p1, c1) in zip(STOPS, STOPS[1:]):
                if t <= p1:
                    px[x, y] = lerp(c0, c1, (t - p0) / (p1 - p0))
                    break
    return img


def mark(size, scale=4):
    """The ring and the R on a transparent square, drawn large and scaled down for smooth edges."""
    s = size * scale
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    ring = gradient(s // 4).resize((s, s), Image.BICUBIC)
    mask = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse((0, 0, s - 1, s - 1), fill=255)
    out.paste(ring, (0, 0), mask)
    d = ImageDraw.Draw(out)
    band = round(s * 0.085)
    d.ellipse((band, band, s - 1 - band, s - 1 - band), fill=INNER + (255,))
    font = ImageFont.truetype(FONT, round(s * 0.56))
    box = d.textbbox((0, 0), "R", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0] + s * 0.01, (s - h) / 2 - box[1]), "R", font=font, fill=(255, 255, 255, 255))
    return out.resize((size, size), Image.LANCZOS)


def on_background(canvas, mark_size, transparent=False):
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0) if transparent else BG + (255,))
    m = mark(mark_size)
    off = (canvas - mark_size) // 2
    img.alpha_composite(m, (off, off))
    return img


# iPhone / store icon: full square, no transparency (iOS rounds the corners itself).
on_background(1024, 700).convert("RGB").save(f"{OUT}/icon.png")
# Android adaptive icon: the mark must sit inside the middle 66% safe zone; the background is a separate layer.
on_background(1024, 560, transparent=True).save(f"{OUT}/android-icon-foreground.png")
Image.new("RGB", (1024, 1024), BG).save(f"{OUT}/android-icon-background.png")
# Splash: just the mark; app.json paints the near-black behind it.
on_background(512, 400, transparent=True).save(f"{OUT}/splash-icon.png")
on_background(48, 40).convert("RGB").save(f"{OUT}/favicon.png")
# A preview with rounded corners, the way it looks on a phone.
prev = on_background(512, 350)
rmask = Image.new("L", (512, 512), 0)
ImageDraw.Draw(rmask).rounded_rectangle((0, 0, 511, 511), radius=115, fill=255)
p = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
p.paste(prev, (0, 0), rmask)
p.save(ROOT / "assets/app-icon.png")
print("ok")
