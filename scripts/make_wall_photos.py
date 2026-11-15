"""Builds the small photos for the moving photo wall on the Home screen.

Run from the repo root after adding photos to data/curated-photos:
    python3 scripts/make_wall_photos.py

It writes square thumbnails to apps/mobile/assets/wall/ and the list the
app reads to apps/mobile/src/ui/wallPhotos.ts. The photos are bundled in
the app so the wall works before the server is running.
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CURATED = ROOT / "data" / "curated-photos"
OUT = ROOT / "apps" / "mobile" / "assets" / "wall"
LIST = ROOT / "apps" / "mobile" / "src" / "ui" / "wallPhotos.ts"
SIZE = 360  # three times the on-screen size, so they stay sharp

# Two rows, meals and drinks mixed so each row has variety.
ROWS = [
    ["ramen", "aperol-spritz", "chicken-tikka-masala", "cosmopolitan", "pepperoni-pizza", "mojito", "pho", "negroni"],
    ["old-fashioned", "paella", "margarita", "fish-tacos", "espresso-martini", "lasagna", "blue-hawaii", "shrimp-scampi-pasta"],
]

manifest = json.loads((CURATED / "manifest.json").read_text())
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.jpg"):
    old.unlink()
for name in (n for row in ROWS for n in row):
    im = Image.open(CURATED / f"{name}.jpg").convert("RGB")
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    im.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS).save(
        OUT / f"{name}.jpg", "JPEG", quality=78, optimize=True, progressive=True
    )

rows_ts = ",\n".join(
    "  [\n" + "".join(f'    require("../../assets/wall/{n}.jpg"),\n' for n in row) + "  ]" for row in ROWS
)
LIST.write_text(
    "// Made by scripts/make_wall_photos.py from data/curated-photos. Do not edit by hand; run the script.\n\n"
    "/** How many hand-picked cover photos the app has. */\n"
    f"export const CURATED_COUNT = {len(manifest['photos'])};\n\n"
    "/** The two rows of photos on the Home screen's moving photo wall. */\n"
    f"export const WALL_ROWS: number[][] = [\n{rows_ts},\n];\n"
)
print(f"{sum(len(r) for r in ROWS)} wall photos, {len(manifest['photos'])} curated in total")
