#!/usr/bin/env python3
"""Fail if any kerned pair with a borrowed Atkinson glyph (b d p q l 1) makes two glyphs' ink touch.

MedBrains Sans borrows six glyphs from Atkinson Hyperlegible Next into Plex's spacing and kerning.
Kerning written for Plex's shapes could pull a borrowed shape into its neighbour. This shapes every
pair of a borrowed glyph with each printable ASCII character, both orders, with HarfBuzz (so GPOS
kerning applies), at several weights of the committed web font, and intersects the two outlines.

    python3 -I tools/fonts/check_glyph_collisions.py [font]    # default: the committed web font
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import pathops
import uharfbuzz as hb
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

FONT = Path(__file__).resolve().parents[2] / "packages/design-system/src/assets/fonts/MedBrainsSans-latin.woff2"
BORROWED = "bdpql1"
NEIGHBOURS = "".join(chr(c) for c in range(33, 127))
WEIGHTS = (400, 440, 550, 700)


def outline(glyphs, name: str, x: float) -> pathops.Path:
    """A glyph's outline as a path, moved to its pen position."""
    path = pathops.Path()
    glyphs[name].draw(TransformPen(path.getPen(glyphSet=glyphs), (1, 0, 0, 1, x, 0)))
    return path


def collisions_at(data: bytes, wght: int) -> list[str]:
    """Every pair whose two outlines overlap at one weight."""
    face = hb.Face(data)
    font = hb.Font(face)
    font.set_variations({"wght": wght})
    static = instancer.instantiateVariableFont(TTFont(io.BytesIO(data)), {"wght": wght})
    glyphs, order = static.getGlyphSet(), static.getGlyphOrder()
    found = []
    for a in BORROWED:
        for b in NEIGHBOURS:
            for pair in (a + b, b + a):
                buffer = hb.Buffer()
                buffer.add_str(pair)
                buffer.guess_segment_properties()
                hb.shape(font, buffer, {"kern": True, "liga": False})
                infos, positions = buffer.glyph_infos, buffer.glyph_positions
                if len(infos) != 2:
                    continue
                first = outline(glyphs, order[infos[0].codepoint], positions[0].x_offset)
                second = outline(glyphs, order[infos[1].codepoint], positions[0].x_advance + positions[1].x_offset)
                overlap = pathops.op(first, second, pathops.PathOp.INTERSECTION)
                if overlap.bounds != (0.0, 0.0, 0.0, 0.0):
                    found.append(f"{pair!r} at wght {wght}")
    return found


def main() -> int:
    """Check every weight; print each collision and exit 1 if there is any."""
    font = TTFont(sys.argv[1] if len(sys.argv) > 1 else FONT)
    font.flavor = None
    out = io.BytesIO()
    font.save(out)
    found = [hit for wght in WEIGHTS for hit in collisions_at(out.getvalue(), wght)]
    for hit in found:
        print(f"ink collision: {hit}", file=sys.stderr)
    pairs = len(BORROWED) * len(NEIGHBOURS) * 2 * len(WEIGHTS)
    print(f"{pairs} pairs shaped, {len(found)} collisions")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
