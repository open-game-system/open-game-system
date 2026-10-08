"""Writes public/art/KIT-SHEET.jpg: every catalogue game's cover, clean hero, logo and icon side by side, to check
a new kit against the others (apps/docs/content/art-and-catalogue.md). Run from apps/tv: python3 scripts/kit-sheet.py"""
import os
import re

from PIL import Image

ART = "public/art"
CATALOGUE = "../../services/api/src/catalogue.ts"
games = re.findall(r'appId: "([^"]+)"', open(CATALOGUE).read())
cols = [("cover.jpg", (200, 300)), ("hero-clean.jpg", (533, 300)), ("logo.png", (420, 300)), ("icon.png", (300, 300))]
gap, bg = 12, (24, 22, 34)
width = sum(w for _, (w, _) in cols) + gap * (len(cols) + 1)
sheet = Image.new("RGB", (width, len(games) * (300 + gap) + gap), bg)
for row, game in enumerate(games):
    x, y = gap, gap + row * (300 + gap)
    for name, (w, h) in cols:
        path = f"{ART}/{game}/{name}"
        if os.path.exists(path):
            im = Image.open(path).convert("RGBA")
            im.thumbnail((w, h))
            tile = Image.new("RGBA", im.size, bg + (255,))
            tile.alpha_composite(im)
            sheet.paste(tile.convert("RGB"), (x + (w - im.width) // 2, y + (h - im.height) // 2))
        x += w + gap
sheet.save(f"{ART}/KIT-SHEET.jpg", quality=82)
print(f"wrote {ART}/KIT-SHEET.jpg ({len(games)} games)")
