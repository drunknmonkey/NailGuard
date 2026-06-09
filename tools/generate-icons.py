#!/usr/bin/env python3
"""Generate the PNG app icons from the same design as icons/icon.svg.

Usage: python3 tools/generate-icons.py
Requires: pillow (pip install pillow)
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

TEAL = (28, 119, 111, 255)        # --accent
NAIL = (255, 253, 250, 255)       # --surface
LUNULA = (158, 207, 196, 255)
SUPERSAMPLE = 4

ICONS_DIR = Path(__file__).resolve().parent.parent / "icons"


def render(size, rounded_corners, art_scale=1.0):
    s = size * SUPERSAMPLE
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if rounded_corners:
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=round(s * 0.22), fill=TEAL)
    else:
        draw.rectangle([0, 0, s - 1, s - 1], fill=TEAL)

    # Nail capsule, proportions matching icons/icon.svg (viewBox 512)
    def px(value):
        return value / 512 * s * art_scale + (s - s * art_scale) / 2

    capsule = [px(166), px(112), px(346), px(418)]
    capsule_radius = (capsule[2] - capsule[0]) / 2

    capsule_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(capsule_mask).rounded_rectangle(capsule, radius=capsule_radius, fill=255)

    nail_layer = Image.new("RGBA", (s, s), NAIL)
    image.paste(nail_layer, (0, 0), capsule_mask)

    lunula_mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(lunula_mask).ellipse(
        [px(146), px(340), px(366), px(496)], fill=255
    )
    lunula_layer = Image.new("RGBA", (s, s), LUNULA)
    image.paste(lunula_layer, (0, 0), ImageChops.multiply(capsule_mask, lunula_mask))

    return image.resize((size, size), Image.LANCZOS)


def main():
    ICONS_DIR.mkdir(exist_ok=True)
    render(192, rounded_corners=True).save(ICONS_DIR / "icon-192.png")
    render(512, rounded_corners=True).save(ICONS_DIR / "icon-512.png")
    # Maskable: full-bleed background, art inside the ~80% safe zone
    render(512, rounded_corners=False, art_scale=0.72).save(ICONS_DIR / "icon-maskable-512.png")
    # Apple touch icon: square, iOS rounds the corners itself
    render(180, rounded_corners=False, art_scale=0.84).save(ICONS_DIR / "apple-touch-icon.png")
    print("Icons written to", ICONS_DIR)


if __name__ == "__main__":
    main()
