#!/usr/bin/env python3
"""Render the round-2 review sheets: candidate bases side by side, and MedBrains Sans Accessible.

1. `medbrains-sans-round2-candidates`: MedBrains Sans built from IBM Plex Sans (v0, shipped),
   Atkinson Hyperlegible Next, Inter and Lexend, each with the same clinical defaults, plus the
   proposed "Easy reading" setting, in columns, light and dark.
2. `medbrains-sans-round2-accessible`: our own font changed in code, one change per column
   (spacing, weight, q tail, apertures, dotted zero, Atkinson hybrid) and the recommended mix.

Every source is pinned in bases.py; nothing here changes the shipped font.

    python3 -I tools/fonts/render_round2.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

sys.path.insert(0, str(Path(__file__).resolve().parent))
import accessible  # noqa: E402
import build_medbrains_sans as build  # noqa: E402
import review_sheet as sheet  # noqa: E402
from render_samples import OUT_DIR  # noqa: E402

CACHE = Path.home() / ".cache/medbrains-fonts"
WEIGHTS = (400, 500, 600, 700)
BUDGET = 40 * 1024
CLINICAL = (
    "10 mg   0.5 mL   1.25 mg/kg   100 IU   5 mL BD",
    "UHID MB-2026-0010 / OPD-11071   lot B10I-O01l",
    "Hb 10.1 g/dL   K+ 5.1   INR 1.10",
    "hydrOXYzine / hydrALAZINE   CeleBREX / CeleXA",
    "खुराक 10 mg, दिन में दो बार (BD) · रक्तचाप 120/80",
)
CONFUSABLES = ("b d p q   rn m   cl d", "Il1|  O0o  5S  2Z  6b  8B")
BLUR_LINES = (*CONFUSABLES, "10 mg  0.5 mL  1.25 mg/kg  INR 1.10")
INSTRUCTION = (
    "Take one 500 mg tablet twice a day after food, for 5 days. Do not take it with milk. "
    "If you get a rash, swelling of the face or trouble breathing, stop the tablets and come "
    "to the hospital at once."
)
SHORT_NAMES = {"plex": "IBM Plex Sans (v0, shipped)", "atkinson": "Atkinson Hyperlegible Next", "inter": "Inter", "lexend": "Lexend"}


def instances(variable: TTFont, wght_for_regular: int = 400) -> dict[int, bytes]:
    """Static instances at the four web weights, as bytes FreeType opens."""
    out = {}
    for wght in WEIGHTS:
        pinned = wght_for_regular if wght == 400 else wght
        out[wght] = build.to_bytes(instancer.instantiateVariableFont(build.reload(variable), {"wght": pinned}))
    return out


def latin_woff2(variable: TTFont) -> tuple[int, bool]:
    """Bytes of the Latin web file the build would ship (weights 400-700), and whether it is hinted."""
    web = instancer.instantiateVariableFont(build.reload(variable), {"wght": build.WEB_WGHT})
    latin = build.smart_dropout(build.cut(web, build.LATIN, hinting=True))
    return len(build.to_bytes(latin, "woff2")), "fpgm" in latin


def metrics(font: TTFont) -> dict[str, object]:
    """The vertical metrics the apparent-size row draws."""
    return {"upm": font["head"].unitsPerEm, "x_height": font["OS/2"].sxHeight, "cap": font["OS/2"].sCapHeight}


def kb(size: int) -> str:
    """Bytes as KB with one decimal."""
    return f"{size / 1024:.1f} KB"


def candidate(key: str, noto: bytes) -> sheet.Column:
    """One base built as MedBrains Sans, with its licence, size and metrics noted."""
    base = build.BASES[key]
    variable = build.medbrains_variable(base, CACHE)
    size, hinted = latin_woff2(variable)
    m = metrics(variable)
    reserved = f"Reserved Font Name: {base.reserved}" if base.reserved else "no Reserved Font Name"
    notes = [
        f"{base.label} · SIL OFL 1.1 · {reserved}",
        f"Latin WOFF2 400-700: {kb(size)} {'hinted' if hinted else 'unhinted'} ({'within' if size <= BUDGET else 'OVER'} 40 KB)",
        f"x-height {m['x_height'] / m['upm']:.3f} em · cap {m['cap'] / m['upm']:.3f} em · avg width {build.average_width(variable):.3f} em",
        f"frozen: {', '.join(base.freeze) or 'slashed zero (outline copy)'}",
        f"gaps: {base.gaps or 'none'}",
    ]
    return sheet.Column(SHORT_NAMES[key], notes, instances(variable), noto, extra={**m, "size": size})


def easy_reading(atkinson: sheet.Column) -> sheet.Column:
    """The proposed per-person setting: the most legible base, 4 px larger, more spacing and leading."""
    notes = [
        "proposed setting, Atkinson Next base",
        "+4 px · letter-spacing 0.04 em · line-height 1.7",
        "no italic or condensed text; honours OS text size",
        f"loaded only when on: {kb(atkinson.extra['size'])}, not first-load",
    ]
    return sheet.Column("Easy reading (setting)", notes, atkinson.weights, atkinson.noto, size_step=4, tracking=0.04, leading=1.7, extra=atkinson.extra)


def weights_cell(column: sheet.Column, theme: str):
    """One line in each web weight, to compare weight steps."""
    names = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold"}
    size = 16 + column.size_step
    step = size * 1.5
    image, draw = sheet.canvas(column, step * 4 + sheet.PAD, theme)
    for row, wght in enumerate(WEIGHTS):
        fonts = (sheet.face(column.weights[wght], size), sheet.face(column.noto, size))
        line = f"{names[wght]} {wght}   10.1 mg   B10I-O01l"
        sheet.text(draw, (sheet.PAD * sheet.SCALE, row * step * sheet.SCALE), line, fonts, sheet.THEMES[theme][1], column.tracking)
    return image


def candidate_rows() -> list[tuple[str, sheet.Cell]]:
    """The tests, top to bottom, for the candidates sheet."""
    rows = [("Font", sheet.notes_cell)]
    rows += [(f"Clinical\n{px} px", sheet.lines_cell(CLINICAL, px)) for px in (12, 14, 16, 24)]
    rows += [(f"Mirror and\nconfusable\n{px} px", sheet.lines_cell(CONFUSABLES, px)) for px in (16, 24)]
    rows.append(("Low vision\n14 px, blur 1.5 px\njust-AA grey", sheet.blurred_cell(BLUR_LINES, 14, 1.5)))
    rows.append(("Patient\ninstruction\n16 px, line 1.5", sheet.paragraph_cell(INSTRUCTION, 16)))
    rows.append(("Apparent size\nsame 56 px\nx-height rule", sheet.xheight_cell))
    rows.append(("Weights\n16 px", weights_cell))
    return rows


def change(title: str, notes: list[str], variable: TTFont, noto: bytes, regular: int = 400) -> sheet.Column:
    """One accessibility change as a column, with its size cost against v0."""
    return sheet.Column(title, notes, instances(variable, regular), noto, width=480, extra=metrics(variable))


def accessible_columns(noto: bytes) -> list[sheet.Column]:
    """v0, each change alone, and the recommended mix."""
    v0 = build.medbrains_variable(build.BASES["plex"], CACHE)
    base_size, _ = latin_woff2(v0)

    def cost(font: TTFont) -> str:
        """Latin WOFF2 size and its difference from v0."""
        size, _ = latin_woff2(font)
        return f"Latin WOFF2 {kb(size)} ({(size - base_size) / 1024:+.1f} KB vs v0)"

    spaced, tailed, dotted = accessible.track(v0, 20), accessible.tail_on_q(v0), accessible.dotted_zero(v0)
    hybrid = accessible.atkinson_hybrid(v0, CACHE)
    mix = accessible.tail_on_q(accessible.track(v0, 12))
    width_cost = build.average_width(spaced) / build.average_width(v0) - 1
    columns = [
        change("v0 (shipped)", ["IBM Plex Sans, slashed zero", cost(v0), "baseline for every column"], v0, noto),
        change("1 Spacing +20 units", ["+2% em side bearings, all glyphs", cost(spaced), f"line length +{width_cost:.1%}", "ships: variable WOFF2, all weights"], spaced, noto),
        change("2 Regular at 440", ["body text at wght 440, not 400", cost(v0) + " (no change)", "web: CSS font-weight 440", "ships: variable WOFF2; statics re-cut"], v0, noto, regular=440),
        change("3 Tail on q", ["breaks p/q mirror (b/d already spurred)", cost(tailed), "ships: variable WOFF2, all weights"], tailed, noto),
        change("4 Open apertures", ["c e s a terminals trimmed", "statics only: a boolean cut breaks", "interpolation; needs a designer for", "the variable font"], v0, noto),
        change("5 Dotted zero", ["Plex ss04 instead of the slash", cost(dotted), "ships: variable WOFF2, all weights"], dotted, noto),
        change("6 Atkinson b d p q l 1", ["borrowed outlines, scaled to Plex", cost(hybrid), "ships: variable WOFF2 (advance", "variations stay Plex's: check bold)"], hybrid, noto),
        change("Recommended mix", ["spacing +12, Regular 440, tail on q", cost(mix), "slashed zero kept", "ships: variable WOFF2, all weights"], mix, noto, regular=440),
    ]
    apertures = columns[4]
    apertures.weights = {w: build.to_bytes(accessible.open_apertures(build.load(data))) for w, data in apertures.weights.items()}
    return columns


def accessible_rows() -> list[tuple[str, sheet.Cell]]:
    """The tests, top to bottom, for the accessible sheet."""
    return [
        ("Change", sheet.notes_cell),
        ("Mirror and\nconfusable\n24 px", sheet.lines_cell((*CONFUSABLES, "ceas  case  sea"), 24)),
        ("Low vision\n14 px, blur 1.5 px\njust-AA grey", sheet.blurred_cell(BLUR_LINES, 14, 1.5)),
        ("Patient\ninstruction\n16 px, line 1.5", sheet.paragraph_cell(INSTRUCTION, 16)),
        ("Clinical\n14 px", sheet.lines_cell(CLINICAL, 14)),
    ]


def main() -> int:
    """Render both sheets, light and dark, as PNG and PDF."""
    noto_font = build.load(build.fetch(build.NOTO["Devanagari"][0], CACHE))
    noto = build.to_bytes(instancer.instantiateVariableFont(noto_font, {"wght": 400}))
    columns = [candidate(key, noto) for key in ("plex", "atkinson", "inter", "lexend")]
    columns.append(easy_reading(columns[1]))
    pages = [sheet.grid(columns, candidate_rows(), theme, f"MedBrains Sans round 2: candidate bases ({theme})") for theme in ("light", "dark")]
    sheet.save(pages, str(OUT_DIR / "medbrains-sans-round2-candidates.png"), str(OUT_DIR / "medbrains-sans-round2-candidates.pdf"))
    changes = accessible_columns(noto)
    pages = [sheet.grid(changes, accessible_rows(), theme, f"MedBrains Sans Accessible: one change per column ({theme})") for theme in ("light", "dark")]
    sheet.save(pages, str(OUT_DIR / "medbrains-sans-round2-accessible.png"), str(OUT_DIR / "medbrains-sans-round2-accessible.pdf"))
    for column in columns[:4]:
        print(f"{column.title:32} {column.extra['size']:>7} B")
    return 0


if __name__ == "__main__":
    sys.exit(main())
