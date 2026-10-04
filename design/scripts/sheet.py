#!/usr/bin/env python3
"""Screen sheets: one labelled tile sheet per device from <dir>/shots + <dir>/scenarios.json."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]
scen = json.load(open(os.path.join(out, "scenarios.json")))
checks = json.load(open(os.path.join(out, "checks.json")))
bad = {s["name"]: s for s in checks["shots"] if "name" in s}
TILE = {"phone": (300, 650, 6), "ipad": (560, 389, 4), "tv": (720, 405, 3), "desktop": (720, 450, 3)}  # w, h, cols
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 15)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
except OSError:
    font = small = ImageFont.load_default()

for device, (w, h, cols) in TILE.items():
    items = [s for s in scen if device in s["devices"] and os.path.exists(os.path.join(out, "shots", f"{s['id']}--{device}.jpg"))]
    if not items:
        continue
    lab = 44
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + 12) + 12, rows * (h + lab + 12) + 12), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for i, s in enumerate(items):
        x = 12 + (i % cols) * (w + 12)
        y = 12 + (i // cols) * (h + lab + 12)
        im = Image.open(os.path.join(out, "shots", f"{s['id']}--{device}.jpg")).convert("RGB")
        im.thumbnail((w, h))
        sheet.paste(im, (x, y + lab))
        d.text((x, y + 2), s["id"], fill=(255, 216, 74), font=font)
        c = bad.get(f"{s['id']}--{device}", {})
        flags = []
        for k, short in (("targetsUnder44", "tgt"), ("contrastFails", "contrast"), ("kidWords", "WORDS"), ("tvSmallText", "small"), ("clippedText", "clip"), ("textOverlaps", "overlap")):
            n = len(c.get(k, []))
            if n:
                flags.append(f"{short}:{n}")
        d.text((x, y + 22), (s["label"][:46] + ("  ⚑ " + " ".join(flags) if flags else "")), fill=(255, 140, 120) if flags else (200, 200, 200), font=small)
    sheet.save(os.path.join(out, f"sheet-{device}.png"), optimize=True)
    print(f"sheet-{device}.png: {len(items)} tiles")
