#!/usr/bin/env python3
"""compare.py <out.png> <shots-root> <scenario-id--device> [...] — one row per variant (every
folder under <shots-root>), the same shots side by side, so variants for one moment compare at a
glance. Missing shots render as a labelled gap."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

out, root, *shots = sys.argv[1:]
variants = sorted(d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d, "shots")))
H = 420
try:
    big = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
except OSError:
    big = small = ImageFont.load_default()
rows = []
for v in variants:
    ims = []
    for sh in shots:
        p = os.path.join(root, v, "shots", sh + ".jpg")
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            im = im.resize((int(im.width * H / im.height), H))
        else:
            im = Image.new("RGB", (int(H * 0.6), H), (60, 30, 30))
            ImageDraw.Draw(im).text((10, 10), "missing\n" + sh, fill=(255, 160, 160), font=small)
        ims.append(im)
    W = sum(i.width for i in ims) + 14 * (len(ims) + 1)
    row = Image.new("RGB", (W, H + 64), (22, 22, 26))
    d = ImageDraw.Draw(row)
    d.text((14, 14), v, fill=(255, 216, 74), font=big)
    x = 14
    for sh, im in zip(shots, ims):
        row.paste(im, (x, 56))
        x += im.width + 14
    rows.append(row)
W = max(r.width for r in rows)
sheet = Image.new("RGB", (W, sum(r.height for r in rows)), (22, 22, 26))
y = 0
for r in rows:
    sheet.paste(r, (0, y))
    y += r.height
sheet.thumbnail((3200, 3200))
sheet.save(out, quality=86)
print(out, sheet.size)
