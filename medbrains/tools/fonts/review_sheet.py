"""Drawing for the round-2 font review sheets: a grid of columns (fonts) by rows (tests).

Each cell is drawn on its own image so a row is as tall as its tallest cell, then the grid is
pasted together. Text is shaped by HarfBuzz (Pillow + raqm) with default features only, like an
app that cannot turn features on, at 2x device pixels.
"""

from __future__ import annotations

import io
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from render_samples import SCALE, THEMES, runs

# A grey that passes WCAG AA (4.5:1) only just, on each surface: the low-contrast test.
LOW_CONTRAST = {"light": "#767676", "dark": "#8b9099"}
LABEL_WIDTH = 150
COLUMN_WIDTH = 600
PAD = 16


@dataclass
class Column:
    """One font under review, with the size, spacing and leading it is shown at."""

    title: str
    notes: list[str]
    weights: dict[int, bytes]
    noto: bytes
    size_step: int = 0
    tracking: float = 0.0
    leading: float = 1.5
    width: int = COLUMN_WIDTH
    extra: dict[str, object] = field(default_factory=dict)


@lru_cache(maxsize=512)
def face(data: bytes, px: float) -> ImageFont.FreeTypeFont:
    """A shaped FreeType face at a CSS pixel size, in device pixels; cached per size."""
    return ImageFont.truetype(io.BytesIO(data), round(px * SCALE), layout_engine=ImageFont.Layout.RAQM)


def text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], line: str, fonts: tuple, fill: str, tracking: float = 0.0) -> float:
    """Draw one line with Noto for Devanagari runs and optional letter spacing (em); returns its width."""
    x, y = xy
    for devanagari, run in runs(line):
        font = fonts[1] if devanagari else fonts[0]
        if devanagari or not tracking:
            if draw is not None:
                draw.text((x, y), run, font=font, fill=fill)
            x += font.getlength(run)
            continue
        extra = tracking * font.size
        for char in run:
            if draw is not None:
                draw.text((x, y), char, font=font, fill=fill)
            x += font.getlength(char) + extra
    return x - xy[0]


def wrap(paragraph: str, fonts: tuple, width: float, tracking: float) -> list[str]:
    """Greedy word wrap to a device-pixel width, measured with the same spacing it is drawn with."""
    lines, current = [], ""
    for word in paragraph.split():
        trial = f"{current} {word}".strip()
        if current and text(None, (0, 0), trial, fonts, "", tracking) > width:
            lines.append(current)
            current = word
        else:
            current = trial
    return [*lines, current]


Cell = Callable[[Column, str], Image.Image]


def canvas(column: Column, height_css: float, theme: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """A blank cell, the column's width, in the theme's surface colour."""
    image = Image.new("RGB", (column.width * SCALE, max(1, round(height_css * SCALE))), THEMES[theme][0])
    return image, ImageDraw.Draw(image)


def lines_cell(lines: tuple[str, ...], px: int, weight: int = 400) -> Cell:
    """A cell of text lines at a size (plus the column's size step), in the column's spacing."""

    def draw_cell(column: Column, theme: str) -> Image.Image:
        """Draws the lines for one column and theme."""
        size = px + column.size_step
        fonts = (face(column.weights[weight], size), face(column.noto, size))
        step = size * max(column.leading, 1.35)
        image, draw = canvas(column, step * len(lines) + PAD, theme)
        for row, line in enumerate(lines):
            text(draw, (PAD * SCALE, row * step * SCALE), line, fonts, THEMES[theme][1], column.tracking)
        return image

    return draw_cell


def blurred_cell(lines: tuple[str, ...], px: int, radius_css: float) -> Cell:
    """Low-vision simulation: the lines in a just-AA grey, then a Gaussian blur."""

    def draw_cell(column: Column, theme: str) -> Image.Image:
        """Draws and blurs the lines for one column and theme."""
        size = px + column.size_step
        fonts = (face(column.weights[400], size), face(column.noto, size))
        step = size * max(column.leading, 1.35)
        image, draw = canvas(column, step * len(lines) + PAD, theme)
        for row, line in enumerate(lines):
            text(draw, (PAD * SCALE, row * step * SCALE), line, fonts, LOW_CONTRAST[theme], column.tracking)
        return image.filter(ImageFilter.GaussianBlur(radius_css * SCALE))

    return draw_cell


def paragraph_cell(paragraph: str, px: int) -> Cell:
    """A wrapped paragraph at a size and the column's leading (1.5 unless the column says more)."""

    def draw_cell(column: Column, theme: str) -> Image.Image:
        """Draws the wrapped paragraph for one column and theme."""
        size = px + column.size_step
        fonts = (face(column.weights[400], size), face(column.noto, size))
        lines = wrap(paragraph, fonts, (column.width - 2 * PAD) * SCALE, column.tracking)
        step = size * column.leading
        image, draw = canvas(column, step * len(lines) + PAD, theme)
        for row, line in enumerate(lines):
            text(draw, (PAD * SCALE, row * step * SCALE), line, fonts, THEMES[theme][1], column.tracking)
        return image

    return draw_cell


def notes_cell(column: Column, theme: str) -> Image.Image:
    """The column's title and notes: base, licence, size, metrics, gaps."""
    title, small = face(column.weights[600], 16), face(column.weights[400], 11)
    image, draw = canvas(column, 30 + 17 * len(column.notes) + PAD, theme)
    draw.text((PAD * SCALE, 4 * SCALE), column.title, font=title, fill=THEMES[theme][1])
    for row, note in enumerate(column.notes):
        draw.text((PAD * SCALE, (30 + row * 17) * SCALE), note, font=small, fill=THEMES[theme][2])
    return image


def xheight_cell(column: Column, theme: str) -> Image.Image:
    """Apparent size: 'Hxgy 0O' at 56 px with baseline, x-height and cap-height rules."""
    px, top = 56, 8
    font = face(column.weights[400], px)
    image, draw = canvas(column, px * 1.45, theme)
    upm, x_height, cap = column.extra["upm"], column.extra["x_height"], column.extra["cap"]
    ascent = font.getmetrics()[0]
    baseline = top * SCALE + ascent
    for value in (0, x_height, cap):
        y = baseline - value / upm * px * SCALE
        draw.line([(PAD * SCALE, y), ((column.width - PAD) * SCALE, y)], fill=THEMES[theme][2], width=1)
    draw.text((PAD * SCALE, top * SCALE), "Hxgy 0O", font=font, fill=THEMES[theme][1])
    return image


def grid(columns: list[Column], rows: list[tuple[str, Cell]], theme: str, heading: str) -> Image.Image:
    """Compose the sheet: a heading, then one band per row with its label and a cell per column."""
    background, ink, muted = THEMES[theme]
    label_font = face(columns[0].weights[600], 12)
    bands = []
    for label, cell in rows:
        cells = [cell(column, theme) for column in columns]
        bands.append((label, cells, max(c.height for c in cells)))
    width = (LABEL_WIDTH + sum(c.width for c in columns)) * SCALE
    height = 60 * SCALE + sum(h + 12 * SCALE for _, _, h in bands)
    sheet = Image.new("RGB", (width, height), background)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD * SCALE, 16 * SCALE), heading, font=face(columns[0].weights[600], 20), fill=ink)
    y = 60 * SCALE
    for label, cells, band in bands:
        draw.line([(0, y - 6 * SCALE), (width, y - 6 * SCALE)], fill=muted, width=1)
        for row, part in enumerate(label.split("\n")):
            draw.text((PAD * SCALE, y + row * 16 * SCALE), part, font=label_font, fill=muted)
        x = LABEL_WIDTH * SCALE
        for image in cells:
            sheet.paste(image, (x, y))
            x += image.width
        y += band + 12 * SCALE
    return sheet


def save(pages: list[Image.Image], png: str, pdf: str) -> None:
    """Stack the pages into one PNG and write one PDF page each."""
    sheet = Image.new("RGB", (max(p.width for p in pages), sum(p.height for p in pages)), "#ffffff")
    top = 0
    for page in pages:
        sheet.paste(page, (0, top))
        top += page.height
    sheet.save(png, optimize=True)
    pages[0].save(pdf, save_all=True, append_images=pages[1:], resolution=72 * SCALE)
