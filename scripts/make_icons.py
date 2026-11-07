#!/usr/bin/env python3
"""Site icons (a plain "UB" on near-black) and the link-preview image.

Writes public/favicon.svg, public/favicon.ico, public/apple-touch-icon.png (180px, for
"Add to Home Screen") and public/og.jpg (1200x630, the picture iMessage / WhatsApp /
LinkedIn show when someone shares a link). Run: python3 scripts/make_icons.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
SERIF_IT = '/System/Library/Fonts/NewYorkItalic.ttf'
SANS = '/System/Library/Fonts/SFNS.ttf'
NAVY, BLUE, CORAL, PEACH, INK = (29, 36, 87), (63, 111, 216), (242, 115, 79), (255, 191, 155), (11, 11, 11)

def dawn(w, h, stops):
    """vertical gradient through (position, colour) stops"""
    y = np.linspace(0, 1, h)[:, None]
    out = np.zeros((h, w, 3))
    for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
        t = np.clip((y - p0) / (p1 - p0), 0, 1)
        m = (y >= p0) & (y <= p1)
        out = np.where(m[..., None], np.array(c0) + (np.array(c1) - np.array(c0)) * t[..., None], out)
    return Image.fromarray(np.broadcast_to(out, (h, w, 3)).astype(np.uint8))

def dither(img, cell):
    """chunky pixels, like the hero's dithered silk"""
    w, h = img.size
    return img.resize((w // cell, h // cell), Image.BILINEAR).resize((w, h), Image.NEAREST)

# ---- app icon: plain white "UB" on near-black, like the home page
S = 720
icon = Image.new('RGB', (S, S), INK)
d = ImageDraw.Draw(icon)
f = ImageFont.truetype(SANS, 330)
f.set_variation_by_name('Semibold')
d.text((S / 2, S / 2 + 6), 'UB', font=f, fill=(244, 242, 238), anchor='mm')
icon.resize((180, 180), Image.LANCZOS).save(PUB / 'apple-touch-icon.png', optimize=True)
icon.resize((64, 64), Image.LANCZOS).save(PUB / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
(PUB / 'favicon.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<rect width="64" height="64" rx="14" fill="#0b0b0b"/>'
    '<text x="32" y="42" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, Inter, Helvetica, Arial, sans-serif" '
    'font-weight="600" font-size="28" letter-spacing="-1" fill="#f4f2ee">UB</text>'
    '</svg>\n')

# ---- link preview: dark, like the home page, with the dawn band across the top
W, H = 1200, 630
og = Image.new('RGB', (W, H), INK)
band = dither(dawn(W, 300, [(0, NAVY), (0.5, BLUE), (0.8, CORAL), (1, INK)]), 15)
og.paste(band, (0, 0))
d = ImageDraw.Draw(og)
head_sans = ImageFont.truetype(SANS, 104)
head_serif = ImageFont.truetype(SERIF_IT, 118)
x = 84
d.text((x, 420), "Hi, I'm ", font=head_sans, fill=(244, 242, 238), anchor='ls')
d.text((x + d.textlength("Hi, I'm ", font=head_sans), 420), 'Udit.', font=head_serif, fill=(244, 242, 238), anchor='ls')
d.text((x, 500), 'Early-stage investor at Z21 Ventures.', font=ImageFont.truetype(SANS, 38), fill=(185, 184, 190), anchor='ls')
og.save(PUB / 'og.jpg', quality=86, optimize=True, progressive=True)
print('wrote favicon.svg, favicon.ico, apple-touch-icon.png, og.jpg')
