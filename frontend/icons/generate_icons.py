#!/usr/bin/env python3
"""Generate PNG icons for Neuro Music PWA."""
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Pillow not installed. Installing...")
    import subprocess
    subprocess.check_call(["pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFont

ICON_DIR = Path(__file__).parent
ICON_DIR.mkdir(exist_ok=True)

# Neuro Music brand colors
BG_COLOR = "#07070c"
ACCENT_COLOR = "#5b3df0"
ACCENT_GRADIENT = ["#5b3df0", "#8f7bff", "#c9a8ff"]
TEXT_COLOR = "#f6f5fb"


def create_gradient_bg(size: int) -> Image.Image:
    """Create a gradient background."""
    img = Image.new("RGBA", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Draw a radial gradient-like effect using ellipses
    for i, color in enumerate(ACCENT_GRADIENT):
        radius = size // 2 - i * (size // 6)
        if radius > 0:
            draw.ellipse(
                [size // 2 - radius, size // 2 - radius, size // 2 + radius, size // 2 + radius],
                fill=color + "40"  # 25% opacity
            )

    return img


def draw_disc_icon(draw: ImageDraw.ImageDraw, size: int, cx: int, cy: int, color: str = TEXT_COLOR):
    """Draw the Neuro Music disc icon."""
    # Outer ring
    outer_r = size // 3
    inner_r = size // 6
    draw.ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], outline=color, width=max(2, size // 64))
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], outline=color, width=max(2, size // 64))

    # Inner dots (representing vinyl grooves)
    for angle in [0, 45, 90, 135, 180, 225, 270, 315]:
        import math
        r = (outer_r + inner_r) // 2
        x = cx + int(r * math.cos(math.radians(angle)))
        y = cy + int(r * math.sin(math.radians(angle)))
        dot_r = max(1, size // 32)
        draw.ellipse([x - dot_r, y - dot_r, x + dot_r, y + dot_r], fill=color)


def generate_icon(size: int, name: str):
    """Generate an icon of specified size."""
    img = create_gradient_bg(size)
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    draw_disc_icon(draw, size, cx, cy)

    # Save
    path = ICON_DIR / f"{name}.png"
    img.save(path, "PNG")
    print(f"Generated {path} ({size}x{size})")


def main():
    # Generate icons for PWA
    generate_icon(192, "icon-192")
    generate_icon(512, "icon-512")
    generate_icon(192, "icon-192-maskable")  # Maskable version (same for simplicity)
    generate_icon(512, "icon-512-maskable")

    # Generate a simple favicon.ico (32x32)
    img_32 = create_gradient_bg(32)
    draw = ImageDraw.Draw(img_32)
    draw_disc_icon(draw, 32, 16, 16)
    img_32.save(ICON_DIR / "favicon.ico", format="ICO", sizes=[(32, 32)])
    print(f"Generated {ICON_DIR / 'favicon.ico'} (32x32)")

    print("All icons generated successfully!")


if __name__ == "__main__":
    main()