r"""Draws the gothic demo pictures in frontend/public/demo (used by /ui/sample/gothic and
`pnpm seed:demo`). Needs Pillow; from the repo root:

    uv --directory backend run python ../frontend/scripts/make-demo-media.py ../frontend/public/demo

The fog loop next to them is made with ffmpeg:

    ffmpeg -f lavfi \
      -i "gradients=s=854x480:c0=0x14040a:c1=0x5a0c1a:c2=0x080205:c3=0x34081a:nb_colors=4:speed=0.015:d=6:r=24" \
      -filter_complex "[0]gblur=sigma=40,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1,noise=alls=2:allf=t,format=yuv420p" \
      -c:v libx264 -preset slow -crf 26 -an -movflags +faststart fog.mp4

(The clip plays forward, then backward: the loop has no seam.)
"""

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
random.seed(7)


def vertical(size, top, bottom):
    w, h = size
    img = Image.new("RGB", size)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / (h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def glow(size, center, radius, color, strength=1.0):
    layer = Image.new("RGB", size, (0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    for i in range(40, 0, -1):
        r = radius * i / 40
        k = (1 - i / 40) ** 2 * strength
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(int(c * k) for c in color))
    return layer.filter(ImageFilter.GaussianBlur(radius / 6))


def grain(img, amount=10):
    """Film grain around the picture's own values: blacks stay black."""
    noise = Image.effect_noise(img.size, amount).convert("RGB")
    lighter = ImageChops.subtract(noise, Image.new("RGB", img.size, (128, 128, 128)))
    darker = ImageChops.subtract(Image.new("RGB", img.size, (128, 128, 128)), noise)
    return ImageChops.subtract(ImageChops.add(img, lighter), darker)


def vignette(img, power=0.75):
    w, h = img.size
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    for i in range(60):
        k = i / 60
        d.ellipse(
            [
                -w * 0.25 + k * w * 0.25,
                -h * 0.25 + k * h * 0.25,
                w * 1.25 - k * w * 0.25,
                h * 1.25 - k * h * 0.25,
            ],
            fill=int(255 * k**power),
        )
    mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) / 10))
    return Image.composite(img, Image.new("RGB", img.size, (0, 0, 0)), mask)


def spire(d, x, base, width, height, color):
    """A gothic tower: body, pointed roof, a lancet window."""
    d.rectangle([x - width / 2, base - height * 0.62, x + width / 2, base], fill=color)
    d.polygon(
        [
            (x - width / 2 - 4, base - height * 0.62),
            (x, base - height),
            (x + width / 2 + 4, base - height * 0.62),
        ],
        fill=color,
    )
    for side in (-1, 1):
        px = x + side * width / 2
        d.polygon(
            [
                (px - 5, base - height * 0.55),
                (px, base - height * 0.75),
                (px + 5, base - height * 0.55),
            ],
            fill=color,
        )


def save(img, name, quality=78):
    img.save(OUT / f"{name}.webp", "WEBP", quality=quality, method=6)
    print(name, (OUT / f"{name}.webp").stat().st_size // 1024, "KB")


def moon_cathedral():
    size = (1600, 1000)
    img = vertical(size, (18, 6, 14), (52, 10, 22))
    img = ImageChops.add(img, glow(size, (1080, 300), 520, (200, 60, 70), 0.9))
    d = ImageDraw.Draw(img)
    d.ellipse([990, 210, 1170, 390], fill=(238, 226, 210))
    img = ImageChops.add(img, glow(size, (1080, 300), 260, (255, 230, 210), 0.5))
    d = ImageDraw.Draw(img)
    for _ in range(140):
        x, y = random.randrange(size[0]), random.randrange(520)
        d.point((x, y), fill=(200, 190, 190))
    sil = (6, 3, 6)
    base = 1000
    d.rectangle([380, 640, 1240, base], fill=sil)
    d.polygon([(700, 640), (810, 470), (920, 640)], fill=sil)
    for x, w, h in (
        (420, 110, 620),
        (1200, 110, 620),
        (560, 70, 470),
        (1060, 70, 470),
        (810, 60, 760),
    ):
        spire(d, x, base, w, h, sil)
    # Rose window and lancets lit from inside.
    d.ellipse([770, 690, 850, 770], fill=(150, 30, 40))
    for x in (460, 560, 1060, 1160):
        d.rounded_rectangle([x - 10, 760, x + 10, 860], radius=10, fill=(120, 26, 34))
    d.rectangle([0, 900, size[0], base], fill=sil)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    save(vignette(grain(img)), "moon")


def candles():
    size = (1200, 900)
    img = vertical(size, (10, 5, 6), (24, 8, 10))
    d = ImageDraw.Draw(img)
    spots = [
        (260, 520, 70, 300),
        (420, 470, 60, 360),
        (600, 560, 80, 260),
        (790, 500, 60, 330),
        (950, 580, 70, 240),
    ]
    lights = Image.new("RGB", size)
    for x, top, w, h in spots:
        lights = ImageChops.add(lights, glow(size, (x, top - 40), 300, (255, 140, 50), 0.8))
    img = ImageChops.add(img, lights)
    d = ImageDraw.Draw(img)
    for x, top, w, h in spots:
        d.rectangle([x - w / 2, top, x + w / 2, top + h + 200], fill=(226, 214, 190))
        d.rectangle([x + w / 4, top, x + w / 2, top + h + 200], fill=(186, 170, 146))
        for k in range(3):  # wax drips
            dx = x - w / 2 + random.uniform(5, w - 15)
            d.rounded_rectangle(
                [dx, top, dx + 9, top + random.uniform(20, 80)], radius=4, fill=(236, 226, 204)
            )
        d.line([(x, top), (x, top - 14)], fill=(30, 20, 15), width=3)
        d.ellipse([x - 9, top - 52, x + 9, top - 12], fill=(255, 214, 140))
        d.ellipse([x - 4, top - 34, x + 4, top - 16], fill=(255, 250, 230))
    save(vignette(grain(img.filter(ImageFilter.GaussianBlur(0.8)))), "candles")


def rose_window():
    size = (1000, 1000)
    img = Image.new("RGB", size, (8, 4, 8))
    d = ImageDraw.Draw(img)
    cx, cy, r = 500, 500, 420
    colors = [
        (170, 20, 40),
        (210, 150, 40),
        (90, 30, 140),
        (30, 70, 140),
        (150, 20, 60),
        (200, 110, 30),
    ]
    for ring, (r0, r1, n) in enumerate(((60, 160, 8), (160, 300, 16), (300, 410, 24))):
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            pts = [(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0))]
            for k in range(12):
                a = a0 + (a1 - a0) * k / 11
                pts.append((cx + r1 * math.cos(a), cy + r1 * math.sin(a)))
            pts.append((cx + r0 * math.cos(a1), cy + r0 * math.sin(a1)))
            d.polygon(pts, fill=colors[(i + ring) % len(colors)], outline=(14, 8, 10), width=9)
    d.ellipse(
        [cx - 60, cy - 60, cx + 60, cy + 60], fill=(220, 170, 60), outline=(14, 8, 10), width=9
    )
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(14, 8, 10), width=18)
    img = ImageChops.add(
        img.filter(ImageFilter.GaussianBlur(1.2)), glow(size, (cx, cy), 480, (120, 40, 50), 0.6)
    )
    save(vignette(grain(img, 12), 0.6), "rose")


def lancet(x, bottom, w, spring):
    """A pointed (equilateral) arch: straight jambs up to `spring`, two arcs to the apex."""
    left, right = x - w / 2, x + w / 2
    pts = [(left, bottom), (left, spring)]
    for k in range(1, 21):  # left arc, centred on the right jamb
        a = math.pi - (math.pi / 3) * k / 20
        pts.append((right + w * math.cos(a), spring - w * math.sin(a)))
    for k in range(20, -1, -1):  # right arc, centred on the left jamb
        a = (math.pi / 3) * k / 20
        pts.append((left + w * math.cos(a), spring - w * math.sin(a)))
    pts += [(right, spring), (right, bottom)]
    return pts


def arches():
    size = (1200, 900)
    img = vertical(size, (60, 10, 18), (16, 4, 8))
    img = ImageChops.add(img, glow(size, (600, 380), 520, (230, 70, 60), 0.9))
    d = ImageDraw.Draw(img)
    # Far wall: a row of small lancets lit from behind.
    far = Image.new("L", size, 255)
    fd = ImageDraw.Draw(far)
    for i in range(7):
        fd.polygon(lancet(240 + i * 120, 640, 70, 420), fill=0)
    img.paste((26, 8, 12), (0, 0), far)
    img = ImageChops.add(img, glow(size, (600, 520), 300, (120, 30, 30), 0.5))
    # Near colonnade: three tall arches, black.
    near = Image.new("L", size, 255)
    nd = ImageDraw.Draw(near)
    for x in (230, 600, 970):
        nd.polygon(lancet(x, 900, 300, 420), fill=0)
    img.paste((5, 2, 4), (0, 0), near.filter(ImageFilter.GaussianBlur(1)))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 860, size[0], 900], fill=(5, 2, 4))
    save(vignette(grain(img.filter(ImageFilter.GaussianBlur(0.6)))), "arches")


def branches(d, x, y, angle, length, width, depth):
    if depth == 0 or length < 4:
        return
    x2, y2 = x + length * math.cos(angle), y - length * math.sin(angle)
    d.line([(x, y), (x2, y2)], fill=(4, 2, 4), width=max(1, int(width)))
    for spread in (-0.5, 0.35):
        branches(
            d,
            x2,
            y2,
            angle + spread + random.uniform(-0.2, 0.2),
            length * random.uniform(0.62, 0.78),
            width * 0.68,
            depth - 1,
        )


def forest():
    size = (1200, 900)
    img = vertical(size, (40, 8, 14), (150, 40, 30))
    img = ImageChops.add(img, glow(size, (600, 760), 520, (240, 120, 60), 0.7))
    d = ImageDraw.Draw(img)
    for x in (120, 330, 520, 760, 980, 1130):
        branches(
            d,
            x + random.uniform(-30, 30),
            900,
            math.pi / 2 + random.uniform(-0.1, 0.1),
            random.uniform(170, 230),
            22,
            9,
        )
    for _ in range(7):  # ravens
        x, y, s = random.uniform(300, 1000), random.uniform(120, 360), random.uniform(10, 20)
        d.polygon(
            [
                (x - s * 2, y),
                (x - s * 0.4, y - s * 0.5),
                (x, y + s * 0.2),
                (x + s * 0.4, y - s * 0.5),
                (x + s * 2, y),
                (x, y - s * 0.1),
            ],
            fill=(6, 2, 4),
        )
    d.rectangle([0, 860, size[0], 900], fill=(4, 2, 4))
    save(vignette(grain(img)), "forest")


def ink():
    size = (900, 1200)
    base = (
        Image.effect_noise((90, 120), 64)
        .resize(size, Image.BICUBIC)
        .filter(ImageFilter.GaussianBlur(26))
    )
    tint = Image.merge(
        "RGB",
        (
            base.point(lambda v: int(v * 0.55)),
            base.point(lambda v: int(v * 0.08)),
            base.point(lambda v: int(v * 0.14)),
        ),
    )
    img = ImageChops.add(tint, glow(size, (450, 520), 480, (110, 20, 40), 0.7))
    d = ImageDraw.Draw(img)
    d.ellipse([300, 300, 600, 700], outline=(210, 170, 90), width=3)
    d.polygon([(450, 330), (480, 500), (450, 670), (420, 500)], outline=(210, 170, 90), width=3)
    d.line([(450, 260), (450, 740)], fill=(210, 170, 90), width=2)
    save(vignette(grain(img.filter(ImageFilter.GaussianBlur(0.5)), 12)), "ink")


for make in (moon_cathedral, candles, rose_window, arches, forest, ink):
    make()
