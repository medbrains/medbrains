#!/usr/bin/env python3
"""Render the easy-read review sheet: v0, the approved round-2 mix and the easy-read mix (shipped).

Columns: MedBrains Sans v0 (Plex + slashed zero), the round-2 mix (spacing +12, Regular 440, tail
on q) and the easy-read mix the build now makes by default (spacing +12, Regular 440, Atkinson
Hyperlegible Next's b d p q l 1 fitted to Plex's spacing). Rows: mirror letters, the low-vision blur
test, the patient instruction and the clinical lines at 12/14/16/24 px, light and dark.

    python3 -I tools/fonts/render_easy_read.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from fontTools.varLib import instancer

sys.path.insert(0, str(Path(__file__).resolve().parent))
import accessible  # noqa: E402
import build_medbrains_sans as build  # noqa: E402
import review_sheet as sheet  # noqa: E402
from render_round2 import BLUR_LINES, CACHE, CLINICAL, CONFUSABLES, INSTRUCTION, instances, kb, latin_woff2, metrics  # noqa: E402
from render_samples import OUT_DIR  # noqa: E402


def column(title: str, notes: list[str], variable, noto: bytes, regular: int) -> sheet.Column:
    """One version of the font, its Regular drawn at the weight that version uses."""
    size, _ = latin_woff2(variable)
    return sheet.Column(title, [*notes, f"Latin WOFF2 400-700: {kb(size)}"], instances(variable, regular), noto, width=560, extra=metrics(variable))


def rows() -> list[tuple[str, sheet.Cell]]:
    """The tests, top to bottom."""
    out = [("Version", sheet.notes_cell)]
    out.append(("Mirror and\nconfusable\n24 px", sheet.lines_cell((*CONFUSABLES, "quiet pebble 1 l"), 24)))
    out.append(("Low vision\n14 px, blur 1.5 px\njust-AA grey", sheet.blurred_cell(BLUR_LINES, 14, 1.5)))
    out.append(("Patient\ninstruction\n16 px, line 1.5", sheet.paragraph_cell(INSTRUCTION, 16)))
    out += [(f"Clinical\n{px} px", sheet.lines_cell(CLINICAL, px)) for px in (12, 14, 16, 24)]
    return out


def main() -> int:
    """Render the three columns, light and dark, as PNG and PDF."""
    noto_font = build.load(build.fetch(build.NOTO["Devanagari"][0], CACHE))
    noto = build.to_bytes(instancer.instantiateVariableFont(noto_font, {"wght": 400}))
    plex = build.BASES["plex"]
    v0 = build.medbrains_variable(plex, CACHE, easy_read=False)
    columns = [
        column("v0", ["IBM Plex Sans + slashed zero", "Regular 400"], v0, noto, 400),
        column("Round-2 mix (approved)", ["spacing +12, Regular 440, tail on q"], accessible.tail_on_q(accessible.track(v0, 12)), noto, 440),
        column("Easy-read mix (shipped)", ["spacing +12, Regular 440, slashed zero", "Atkinson Next b d p q l 1, fitted"], build.medbrains_variable(plex, CACHE), noto, plex.regular_wght),
    ]
    pages = [sheet.grid(columns, rows(), theme, f"MedBrains Sans easy-read mix ({theme})") for theme in ("light", "dark")]
    sheet.save(pages, str(OUT_DIR / "medbrains-sans-easy-read.png"), str(OUT_DIR / "medbrains-sans-easy-read.pdf"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
