#!/usr/bin/env python3
"""Download Google Fonts for self-hosting."""
import re
import requests
from pathlib import Path

FONTS_DIR = Path(__file__).parent
FONTS_DIR.mkdir(exist_ok=True)

# Font specifications
FONTS = {
    "Space Grotesk": {
        "weights": {
            500: "SpaceGrotesk-Medium.ttf",
            600: "SpaceGrotesk-SemiBold.ttf",
            700: "SpaceGrotesk-Bold.ttf",
        }
    },
    "Inter": {
        "weights": {
            400: "Inter-Regular.ttf",
            500: "Inter-Medium.ttf",
            600: "Inter-SemiBold.ttf",
            700: "Inter-Bold.ttf",
        }
    }
}

def download_fonts():
    """Download font files from Google Fonts API."""
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })

    for family, data in FONTS.items():
        weights = ";".join(str(w) for w in data['weights'].keys())
        family_param = family.replace(" ", "+")
        url = f"https://fonts.googleapis.com/css2?family={family_param}:wght@{weights}&display=swap"

        response = session.get(url)
        if response.status_code != 200:
            print(f"Failed to fetch CSS for {family}: {response.status_code}")
            print(f"URL: {url}")
            continue

        css_content = response.text

        # Extract TTF URLs with weights
        weight_pattern = r'font-weight:\s*(\d+)[^}]*url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)'
        weight_urls = re.findall(weight_pattern, css_content)

        weight_to_url = {int(w): u for w, u in weight_urls}

        for weight, filename in data["weights"].items():
            if weight in weight_to_url:
                font_url = weight_to_url[weight]
                try:
                    resp = session.get(font_url)
                    if resp.status_code == 200:
                        filepath = FONTS_DIR / filename
                        filepath.write_bytes(resp.content)
                        print(f"Downloaded {filename} ({len(resp.content)} bytes)")
                    else:
                        print(f"Failed to download {filename}: {resp.status_code}")
                except Exception as e:
                    print(f"Error downloading {filename}: {e}")
            else:
                print(f"No URL found for {family} weight {weight}")

    print("Font download complete!")


if __name__ == "__main__":
    download_fonts()