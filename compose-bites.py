#!/usr/bin/env python3
"""
Quick-bite compositor.

Ajeet supplies each bite as TWO files — a photographic background and the UI as
a trimmed, transparent PNG — and this composes the two surfaces that need them:

  carousel  2048x1152 (16:9)  — must stay exactly this, it is a 1:1 pixel match
                               with the texture canvas curved-gallery.js paints
                               into (CW=2048, CH=1152). Any other size is
                               resampled on the way to the card; any other RATIO
                               is silently cover-cropped by paint().
  modal     1600x1200 (4:3)   — the detail view. 4:3 rather than 16:9 because the
                               modal panel is much taller than a 16:9 box in that
                               column, so a wider-than-tall asset leaves the
                               bottom third of the card empty. 4:3 fills it.
                               NOT 1:1: the shot's WIDTH is fixed by the grid
                               column, so a square frame cannot make the UI any
                               bigger — it only trades backdrop for nothing.

Why compose here rather than ship one flat export: the two surfaces want
different framing of the same artwork. The carousel is art direction — the UI
sits large and offset right, with the photograph readable around it. The modal
is for reading the UI, so the backdrop shrinks to a margin.

Usage:  python3 compose-bites.py            # writes into images/
        python3 compose-bites.py --check     # report only, writes nothing
"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter

SRC = os.path.expanduser('~/Downloads')
OUT = 'images'

# slug, background file, content file. Slugs match the `WORK` entries in
# js/gallery-assets.js; the numbered filenames are Ajeet's export order.
BITES = [
    ('checkout-sdk',    'first background.png', 'First content.png'),
    ('prompt-ops',      'Second bg.png',        'second content.png'),
    ('loan-offers',     'Third bg.png',         'Third content.png'),
    ('lender-config',   'fourth bg.png',        'Fourth content.png'),
    ('call-audits',     'Fifth bg.png',         'fifth content.png'),
    ('connector-setup', 'sixth bg.png',         'sixth content.png'),
    ('coin-rewards',    'seventh bg.png',       'seventh content.png'),
    ('booking-flow',    'eight bg.png',         'eigth content.png'),
]

# ── carousel framing ──────────────────────────────────────────────────────
CARD_W, CARD_H = 2048, 1152
# Content height as a fraction of the frame. Measured off the composites this
# replaces: the console sat at 0.775 and the phones at 0.866, so one rule at
# 0.82 lands both within a few per cent of where they were and keeps the six
# bites that have NOT been recomposed looking like part of the same deck.
CARD_CONTENT_H = 0.82
CARD_RIGHT     = 0.045   # right margin — the UI is offset right, photo reads left

# ── modal framing ─────────────────────────────────────────────────────────
DET_W, DET_H = 1600, 1200
# 0.95, against the ~0.875 the old auto-cropper left. This is the view where the
# work is actually read, so the backdrop is a margin rather than a subject.
DET_CONTENT  = 0.95

def prepare(ct):
    """Give content a usable alpha channel.

    Most of these arrive trimmed with real transparency. One (the Hyperswitch
    browser window) was flattened onto BLACK instead, so its alpha is a solid
    255 and its rounded corners survive only as a ~5px near-black fringe —
    composited straight onto a photograph that reads as four dark notches.

    Detected rather than special-cased by filename: a fully opaque content
    image is assumed to be a flattened rectangle, so the fringe is cropped and
    a rounded-rect alpha is rebuilt at the radius the window was drawn with.
    Anything that already carries alpha is passed through untouched."""
    if ct.getchannel('A').getextrema()[0] != 255:
        return ct
    ct = ct.crop((FRINGE, FRINGE, ct.width - FRINGE, ct.height - FRINGE))
    r = round(ct.width * CORNER)
    mask = Image.new('L', ct.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, ct.width - 1, ct.height - 1], r, fill=255)
    ct.putalpha(mask)
    return ct

def cover(im, w, h):
    """Scale to cover w x h, centre-crop the overflow."""
    s = max(w / im.width, h / im.height)
    r = im.resize((max(w, round(im.width * s)), max(h, round(im.height * s))), Image.LANCZOS)
    return r.crop(((r.width - w) // 2, (r.height - h) // 2,
                   (r.width - w) // 2 + w, (r.height - h) // 2 + h))

# Drop shadow. The supplied PNGs are trimmed hard to the artwork — their alpha
# carries the rounded corners and nothing beyond — so without this the UI sits
# on the photograph like a sticker. Cast from the artwork's own alpha, so it
# follows the real silhouette (two separate phones cast two shadows) rather than
# being a rectangle behind the bounding box. Proportional to the content's size,
# not absolute, so the carousel and the modal read the same.
SHADOW_BLUR    = 0.018   # x content height
SHADOW_DROP    = 0.012
SHADOW_OPACITY = 0.30
SHADOW_INK     = (10, 18, 28)

# Repair values for content that arrives flattened rather than transparent —
# see prepare(). FRINGE clears the anti-aliased edge; CORNER is the window's
# own corner radius as a fraction of its width.
FRINGE = 8
CORNER = 0.008

def place(bg, content, box_w, box_h, frac, anchor):
    """Scale content to `frac` of the box (whichever axis binds) and paste."""
    s = min(box_w * frac / content.width, box_h * frac / content.height)
    cw, ch = round(content.width * s), round(content.height * s)
    c = content.resize((cw, ch), Image.LANCZOS)
    if anchor == 'right':
        x = round(box_w * (1 - CARD_RIGHT)) - cw
    else:
        x = (box_w - cw) // 2
    y = (box_h - ch) // 2

    mask = Image.new('L', (box_w, box_h), 0)
    mask.paste(c.getchannel('A'), (x, y + round(ch * SHADOW_DROP)))
    mask = mask.filter(ImageFilter.GaussianBlur(ch * SHADOW_BLUR))
    mask = mask.point(lambda v: int(v * SHADOW_OPACITY))
    bg.paste(Image.new('RGB', (box_w, box_h), SHADOW_INK), (0, 0), mask)

    bg.paste(c, (x, y), c)
    return cw, ch, x, y

def build(slug, bgf, ctf, check=False):
    bg = Image.open(os.path.join(SRC, bgf)).convert('RGB')
    ct = prepare(Image.open(os.path.join(SRC, ctf)).convert('RGBA'))
    rows = []
    for name, W, H, frac, anchor, q in (
        ('bite-%s.jpg'        % slug, CARD_W, CARD_H, CARD_CONTENT_H, 'right',  84),
        ('bite-%s-detail.jpg' % slug, DET_W,  DET_H,  DET_CONTENT,    'centre', 86),
    ):
        # place() fits to whichever axis binds. On the 16:9 carousel that is
        # always height (both contents are far less wide than the frame), which
        # is what makes CARD_CONTENT_H mean what it says.
        canvas = cover(bg, W, H)
        cw, ch, x, y = place(canvas, ct, W, H, frac, anchor)
        path = os.path.join(OUT, name)
        if not check:
            canvas.save(path, 'JPEG', quality=q, subsampling=1, optimize=True, progressive=True)
        size = os.path.getsize(path) / 1024 if os.path.exists(path) else 0
        rows.append('  %-30s %4dx%-4d  content %4dx%-4d at (%4d,%4d)  %.0fkB'
                    % (name, W, H, cw, ch, x, y, size))
    print('%s  (bg %dx%d, content %dx%d r=%.3f)' % (slug, bg.width, bg.height, ct.width, ct.height, ct.width/ct.height))
    print('\n'.join(rows))

if __name__ == '__main__':
    check = '--check' in sys.argv
    for b in BITES:
        build(*b, check=check)
