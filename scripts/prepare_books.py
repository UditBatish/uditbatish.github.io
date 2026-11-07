#!/usr/bin/env python3
"""Prepare the bookshelf.

Cover originals live in books-in/<id>.jpg (gitignored). For each book below this:
  - saves a web-sized cover to public/covers/<id>.jpg (metadata dropped)
  - picks the spine colour from the cover's dominant colour, plus an accent colour
    and a readable text colour
  - rewrites src/books-data.js in shelf order

Run: python3 scripts/prepare_books.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'books-in', ROOT / 'public' / 'covers'

SHELVES = [
    ('Favourites', ['chip-war', 'money-trap', 'cold-start', 'buildit', 'zero-to-scale', 'creativity-inc']),
    ('Shelf', ['speed-scale', 'breakneck', 'against-all-odds', 'india-way', 'exercise-power', 'backstage-climate',
               'green-startups', 'narrative-numbers', 'darwin-investing', 'the-firm', 'barbarians', 'unseen', 'nexus',
               'sapiens', 'selfish-gene', 'utopia-realists', 'beyond-good-evil', 'messi']),
]

# id: (title, subtitle, author, year published, approx pages). Pages only set spine thickness.
# note: optional one-liner in Udit's words, shown in the book's detail view.
BOOKS = {
    'money-trap': ('The Money Trap', 'Grand Fortunes and Lost Illusions Inside the Tech Bubble', 'Alok Sama', 2024, 352),
    'selfish-gene': ('The Selfish Gene', '', 'Richard Dawkins', 1976, 360),
    'chip-war': ('Chip War', "The Fight for the World's Most Critical Technology", 'Chris Miller', 2022, 464),
    'cold-start': ('The Cold Start Problem', 'How to Start and Scale Network Effects', 'Andrew Chen', 2021, 384),
    'zero-to-scale': ('Zero to Scale', 'A Playbook to Build Consumer Brands in India', 'Arindam Paul', 2025, 260),
    'buildit': ('Buildit', 'Building Blinkit in an Evolving India', 'Albinder Singh Dhindsa', 2026, 240),
    'against-all-odds': ('Against All Odds', 'The IT Story of India', 'Kris Gopalakrishnan, N. Dayasindhu and Krishnan Narayanan', 2022, 400),
    'breakneck': ('Breakneck', "China's Quest to Engineer the Future", 'Dan Wang', 2025, 304),
    'narrative-numbers': ('Narrative and Numbers', 'The Value of Stories in Business', 'Aswath Damodaran', 2017, 288),
    'darwin-investing': ('What I Learned About Investing from Darwin', '', 'Pulak Prasad', 2023, 328),
    'beyond-good-evil': ('Beyond Good and Evil', '', 'Friedrich Nietzsche', 1886, 240),
    'green-startups': ("India's Green Startups", 'Entrepreneurs That Are Driving Growth', 'Jayant Sinha and Sandiip Bhammer', 2024, 280),
    'creativity-inc': ('Creativity, Inc.', 'Overcoming the Unseen Forces That Stand in the Way of True Inspiration', 'Ed Catmull with Amy Wallace', 2014, 368),
    'speed-scale': ('Speed & Scale', 'An Action Plan for Solving Our Climate Crisis Now', 'John Doerr', 2021, 464),
    'backstage-climate': ('Backstage Climate', 'The Science and Politics Behind Climate Change', 'Rajan Mehta', 2024, 300),
    'india-way': ('The India Way', 'Strategies for an Uncertain World', 'S. Jaishankar', 2020, 240),
    'exercise-power': ('Exercise of Power', 'American Failures, Successes, and a New Path Forward in the Post-Cold War World', 'Robert M. Gates', 2020, 480),
    'nexus': ('Nexus', 'A Brief History of Information Networks from the Stone Age to AI', 'Yuval Noah Harari', 2024, 528),
    'sapiens': ('Sapiens', 'A Brief History of Humankind', 'Yuval Noah Harari', 2011, 464),
    'the-firm': ('The Firm', 'The Story of McKinsey and Its Secret Influence on American Business', 'Duff McDonald', 2013, 400),
    'barbarians': ('Barbarians at the Gate', 'The Fall of RJR Nabisco', 'Bryan Burrough and John Helyar', 1989, 592),
    'utopia-realists': ('Utopia for Realists', 'How We Can Build the Ideal World', 'Rutger Bregman', 2016, 336),
    'messi': ('Messi', 'The Definitive Biography', 'Guillem Balagué', 2013, 560),
    'unseen': ('Unseen', 'The Untold Story of Deepinder Goyal and the Making of Zomato', 'Megha Vishwanath', 2025, 312),
}
NOTES = {}   # e.g. 'chip-war': 'A line on why it stuck.'

# Spine colours set by hand where the cover's dominant colour is a plain white
# background or Udit's own copy looks different: (spine, accent, ink)
SPINE_OVERRIDES = {
    'selfish-gene': ('#262626', '#d4a24c', '#f3e7cf'),        # his Oxford edition: black, gold type
    'narrative-numbers': ('#f5f5f1', '#4f8f2a', '#2d5a1c'),   # his copy: white, green type
    'money-trap': ('#f3f3f1', '#d3262c', '#111111'),
    'chip-war': ('#fbfaf7', '#c69a3e', '#111111'),
}

def hexc(c): return '#%02x%02x%02x' % tuple(int(v) for v in c)
def lum(c): return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255
def sat(c): return max(c) - min(c)

OUT.mkdir(parents=True, exist_ok=True)
data = []
for shelf, ids in SHELVES:
    books = []
    for bid in ids:
        title, subtitle, author, year, pages = BOOKS[bid]
        im = Image.open(SRC / f'{bid}.jpg').convert('RGB')
        if im.height > 900:
            im = im.resize((round(im.width * 900 / im.height), 900), Image.LANCZOS)
        im.save(OUT / f'{bid}.jpg', quality=88, optimize=True)
        # dominant colour = biggest bucket of a 6-colour quantize; accent = most saturated other bucket
        q = im.resize((80, 120)).quantize(6, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()[:18]
        counts = sorted(q.getcolors(), reverse=True)
        cols = [(n, tuple(pal[i * 3:i * 3 + 3])) for n, i in counts]
        spine = cols[0][1]
        others = [c for _, c in cols[1:] if abs(lum(c) - lum(spine)) > 0.15] or [cols[1][1]]
        accent = max(others, key=sat)
        ink = '#111111' if lum(spine) > 0.55 else '#ffffff'
        spine_hex, accent_hex = hexc(spine), hexc(accent)
        if bid in SPINE_OVERRIDES:
            spine_hex, accent_hex, ink = SPINE_OVERRIDES[bid]
        books.append({
            'id': bid, 'title': title, 'subtitle': subtitle, 'author': author, 'year': year,
            'pages': pages, 'cover': f'/covers/{bid}.jpg', 'aspect': round(im.height / im.width, 3),
            'spine': spine_hex, 'accent': accent_hex, 'ink': ink, 'note': NOTES.get(bid, ''),
        })
        print(f'{bid:18} spine {spine_hex} accent {accent_hex} ink {ink}  {im.size}')
    data.append({'name': shelf, 'books': books})

(ROOT / 'src' / 'books-data.js').write_text(
    '// Generated by scripts/prepare_books.py. Edit the lists there, not here.\n'
    'export const shelves = ' + json.dumps(data, indent=2, ensure_ascii=False) + ';\n'
)
