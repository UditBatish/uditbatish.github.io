#!/usr/bin/env python3
"""Make the home page's Books card image: Udit's favourite books lying on a wooden
table, photographed from above.

Covers come from public/covers/. The table is generated (planks + grain). Each book gets
a cream page block peeking out on two sides, a soft drop shadow and a slight tilt.
Output: public/books/flatlay.jpg (portrait; the reel card crops it to its own shape, so
the books stay around the middle).

Run: python3 scripts/make_flatlay.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
COVERS = ROOT / 'public' / 'covers'
OUT = ROOT / 'public' / 'books' / 'flatlay.jpg'
W, H = 900, 1500
rng = np.random.default_rng(7)

# ---------- the table: vertical oak planks with grain ----------
def table():
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    # grain: low-frequency noise stretched along the planks, plus fine streaks
    coarse = Image.fromarray((rng.random((5, 40)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    fine = Image.fromarray((rng.random((18, 160)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    g = np.asarray(coarse, float) / 255 * 0.8 + np.asarray(fine, float) / 255 * 0.2
    g = 0.5 + 0.5 * np.sin(g * 6 + x * 2)                      # long, soft grain bands
    g = 0.75 * g + 0.25 * (np.asarray(fine, float) / 255)      # a little texture inside each band
    dark, light = np.array([150, 100, 62]), np.array([196, 146, 98])
    img = dark + (light - dark) * g[..., None]
    # plank seams and a slight tone change per plank
    plank = 225
    for i, x0 in enumerate(range(0, W, plank)):
        img[:, x0:x0 + plank] *= 0.94 + 0.08 * rng.random()
        img[:, max(0, x0 - 1):x0 + 2] *= 0.62
    # warm light from the top left, soft vignette
    light_fall = 1.08 - 0.22 * np.sqrt((x - 0.2) ** 2 + (y - 0.15) ** 2)
    img *= light_fall[..., None]
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1))

# ---------- one book seen from above ----------
def book(cover_id, width):
    cover = Image.open(COVERS / f'{cover_id}.jpg').convert('RGB')
    h = round(width * cover.height / cover.width)
    cover = cover.resize((width, h), Image.LANCZOS)
    d = 7                                                       # page block showing on right and bottom
    b = Image.new('RGBA', (width + d, h + d), (0, 0, 0, 0))
    pages = Image.new('RGBA', (width, h), (238, 230, 214, 255))
    pd = ImageDraw.Draw(pages)
    for k in range(0, max(width, h), 3):                        # page lines
        pd.line([(k, 0), (k, h)], fill=(222, 212, 194, 255))
    b.alpha_composite(pages, (d, d))
    b.alpha_composite(cover.convert('RGBA'), (0, 0))
    # a hint of sheen across the cover
    sheen = Image.new('L', cover.size, 0)
    ImageDraw.Draw(sheen).polygon([(0, 0), (width * 0.55, 0), (width * 0.15, h), (0, h)], fill=22)
    white = Image.new('RGBA', cover.size, (255, 255, 255, 0)); white.putalpha(sheen)
    b.alpha_composite(white, (0, 0))
    return b

def place(canvas, img, cx, cy, angle):
    rot = img.rotate(angle, resample=Image.BICUBIC, expand=True)
    x, y = round(cx - rot.width / 2), round(cy - rot.height / 2)
    a = rot.split()[3]
    # soft shadow (light from the top left) + a tight contact shadow
    for blur, off, strength in ((22, (16, 20), 0.45), (4, (4, 5), 0.5)):
        sh = Image.new('RGBA', rot.size, (25, 14, 6, 0))
        sh.putalpha(a.point(lambda v: int(v * strength)))
        sh = sh.filter(ImageFilter.GaussianBlur(blur))
        canvas.alpha_composite(sh, (x + off[0], y + off[1]))
    canvas.alpha_composite(rot, (x, y))

# favourites, set down casually: a loose two-column layout, each book a little off
# straight and off the grid, slightly different sizes. No two books touch: there is
# always table showing between them (checked below).
LAYOUT = [  # id, centre x, top, tilt (deg), width
    ('creativity-inc', 250, 58, -4, 262),
    ('chip-war', 650, 36, 3.5, 256),
    ('buildit', 262, 548, 4.5, 250),
    ('money-trap', 640, 520, -2.5, 266),
    ('cold-start', 244, 1046, -2, 262),
    ('zero-to-scale', 656, 1020, 5, 254),
]
GAP = 24   # minimum px of table between any two books

canvas = table().convert('RGBA')
boxes = []
for cid, cx, top, ang, w in LAYOUT:
    b = book(cid, w)
    cy = top + b.height / 2
    rw, rh = b.rotate(ang, expand=True).size
    boxes.append((cid, cx - rw / 2, cy - rh / 2, cx + rw / 2, cy + rh / 2))
    place(canvas, b, cx, cy, ang)
# keep every pair of books apart (rotated bounding boxes, so this is on the safe side)
for i, a in enumerate(boxes):
    for c in boxes[i + 1:]:
        gx = max(c[1] - a[3], a[1] - c[3]); gy = max(c[2] - a[4], a[2] - c[4])
        assert max(gx, gy) >= GAP, f'{a[0]} and {c[0]} are too close ({max(gx, gy):.0f}px)'
    assert a[1] >= 0 and a[3] <= W and a[2] >= 0 and a[4] <= H, f'{a[0]} runs off the table'
OUT.parent.mkdir(parents=True, exist_ok=True)
canvas.convert('RGB').save(OUT, quality=86, optimize=True, progressive=True)
print('wrote', OUT.relative_to(ROOT), canvas.size)
