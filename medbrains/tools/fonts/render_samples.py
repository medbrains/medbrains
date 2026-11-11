#!/usr/bin/env python3
"""Render the MedBrains Sans review sheet: IBM Plex Sans and MedBrains Sans side by side.

The owner reviews the font on this sheet, not in a font editor: doses, IDs, lab values, the classic
confusables and look-alike drug names, in each weight, light and dark, at 12/14/16/24 px. It is drawn
at 2x device pixels, like a laptop screen, with HarfBuzz shaping (Pillow + raqm) and default features
only, so it shows what an app gets without turning any feature on.

    python3 -I tools/fonts/render_samples.py    # writes docs/design/fonts/medbrains-sans-v0-samples.{png,pdf}
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_medbrains_sans as build  # noqa: E402

OUT_DIR = build.REPO / "medbrains/docs/design/fonts"

WEIGHTS = {"Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700}
SIZES = (12, 14, 16, 24)
SCALE = 2  # device pixels per CSS px
LINES = (
    "10 mg   0.5 mL   1.25 mg/kg   100 IU   5 mL BD",
    "UHID MB-2026-0010 / OPD-11071   lot B10I-O01l",
    "Hb 10.1 g/dL   K+ 5.1   INR 1.10",
    "Il1|  O0o  5S  2Z  8B  6b",
    "hydrOXYzine / hydrALAZINE   CeleBREX / CeleXA",
    "खुराक 10 mg, दिन में दो बार (BD) · रक्तचाप 120/80",
)
# Light and dark surfaces and text from the design tokens (website theme, 2026-10-24).
THEMES = {"light": ("#ffffff", "#0b1220", "#5d677a"), "dark": ("#111315", "#e6e8eb", "#a9afb7")}
GAP = 32


def is_devanagari(char: str) -> bool:
    """Whether a character belongs to the Devanagari block, so it is drawn with the Noto pairing."""
    return "ऀ" <= char <= "ॿ"


def runs(text: str) -> list[tuple[bool, str]]:
    """Split a line into Latin and Devanagari runs; spaces stay with the run they follow."""
    out: list[tuple[bool, str]] = []
    for char in text:
        script = is_devanagari(char) if not char.isspace() or not out else out[-1][0]
        if out and out[-1][0] == script:
            out[-1] = (script, out[-1][1] + char)
        else:
            out.append((script, char))
    return out


def draw_line(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fonts: tuple, fill: str) -> int:
    """Draw one line with per-script font fallback, as a browser does with the font stack; returns its width."""
    x, y = xy
    for devanagari, run in runs(text):
        font = fonts[1] if devanagari else fonts[0]
        draw.text((x, y), run, font=font, fill=fill)
        x += round(font.getlength(run))
    return x - xy[0]


def load(data: bytes, px: int) -> ImageFont.FreeTypeFont:
    """A shaped (raqm) FreeType face at a CSS pixel size, scaled to device pixels."""
    return ImageFont.truetype(io.BytesIO(data), px * SCALE, layout_engine=ImageFont.Layout.RAQM)


def at_weight(font: TTFont, wght: int) -> bytes:
    """A variable font pinned to one weight, as bytes FreeType can open."""
    return build.to_bytes(instancer.instantiateVariableFont(build.reload(font), {"wght": wght}))


def faces(fonts: dict[str, TTFont], weight: str) -> dict[str, bytes]:
    """Font bytes for one weight: the Plex original, MedBrains Sans and the Noto pairing.

    MedBrains Sans' Regular is drawn at its easy-read weight (440), as the apps set it.
    """
    regular = build.BASES["plex"].regular_wght
    return {
        name: at_weight(font, regular if (name == "MedBrains Sans" and weight == "Regular") else WEIGHTS[weight])
        for name, font in fonts.items()
    }


def column_width(data: dict[str, bytes]) -> int:
    """The widest sample at the largest size, so both families get equal, aligned columns."""
    image = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    px = max(SIZES)
    fonts = (load(data["MedBrains Sans"], px), load(data["noto"], px))
    return max(draw_line(image, (0, 0), line, fonts, "#000") for line in LINES) + GAP * SCALE


def panel(data: dict[str, bytes], theme: str, weight: str) -> Image.Image:
    """One weight in one theme: every size, every sample, Plex on the left and ours on the right."""
    background, ink, muted = THEMES[theme]
    col = column_width(data)
    height = (80 + sum(round(px * 1.6) * len(LINES) + 48 for px in SIZES)) * SCALE
    image = Image.new("RGB", (GAP * SCALE + col * 2, height), background)
    draw = ImageDraw.Draw(image)
    label = load(data["MedBrains Sans"], 12)
    draw.text((GAP * SCALE // 2, 16 * SCALE), f"{weight} · {theme}", font=load(data["MedBrains Sans"], 16), fill=ink)
    for index, family in enumerate(("IBM Plex Sans", "MedBrains Sans")):
        draw.text((GAP * SCALE // 2 + index * col, 48 * SCALE), family, font=label, fill=muted)
    y = 80 * SCALE
    for px in SIZES:
        draw.text((GAP * SCALE // 2, y), f"{px} px", font=label, fill=muted)
        y += 24 * SCALE
        for index, family in enumerate(("IBM Plex Sans", "MedBrains Sans")):
            fonts = (load(data[family], px), load(data["noto"], px))
            for row, line in enumerate(LINES):
                draw_line(draw, (GAP * SCALE // 2 + index * col, y + row * round(px * 1.6) * SCALE), line, fonts, ink)
        y += (round(px * 1.6) * len(LINES) + 24) * SCALE
    return image


def page(data: dict[str, bytes], weight: str) -> Image.Image:
    """One weight's page: the light panel beside the dark one."""
    light, dark = panel(data, "light", weight), panel(data, "dark", weight)
    image = Image.new("RGB", (light.width + dark.width, max(light.height, dark.height)), "#ffffff")
    image.paste(light, (0, 0))
    image.paste(dark, (light.width, 0))
    return image


def main() -> int:
    """Render every weight and write the stacked PNG and the one-page-per-weight PDF."""
    cache = Path.home() / ".cache/medbrains-fonts"
    plex = build.BASES["plex"]
    original = instancer.instantiateVariableFont(build.load(build.fetch(plex.font, cache)), {"wdth": 100})
    fonts = {
        "IBM Plex Sans": original,
        "MedBrains Sans": build.medbrains_variable(plex, cache),
        "noto": build.load(build.fetch(build.NOTO["Devanagari"][0], cache)),
    }
    pages = [page(faces(fonts, weight), weight) for weight in WEIGHTS]
    sheet = Image.new("RGB", (max(p.width for p in pages), sum(p.height for p in pages)), "#ffffff")
    top = 0
    for image in pages:
        sheet.paste(image, (0, top))
        top += image.height
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT_DIR / "medbrains-sans-v0-samples.png", optimize=True)
    pages[0].save(OUT_DIR / "medbrains-sans-v0-samples.pdf", save_all=True, append_images=pages[1:], resolution=72 * SCALE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
