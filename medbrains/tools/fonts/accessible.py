"""Candidate accessibility changes to MedBrains Sans, each one alone so the owner can pick.

None of these ships yet: render_accessible.py draws each one beside v0 on a review sheet, with its
size cost. Each function takes the MedBrains Sans variable font (weights 300-700) and returns a
changed copy, except open_apertures, which edits a static instance, because a boolean cut changes
point counts and would break interpolation between weights.
"""

from __future__ import annotations

import copy
from pathlib import Path

import pathops
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates, flagOverlapSimple
from fontTools.varLib import instancer

import build_medbrains_sans as build


def _editable(variable: TTFont) -> TTFont:
    """A copy whose gvar is fully decoded first: gvar decodes against glyf's point counts."""
    font = build.reload(variable)
    if "gvar" in font:
        font["gvar"].ensureDecompiled()
    return font


def _refresh_lsb(font: TTFont, name: str) -> None:
    """Keep hmtx's left side bearing equal to the glyph's new left edge."""
    glyph = font["glyf"][name]
    glyph.recalcBounds(font["glyf"])
    advance = font["hmtx"][name][0]
    font["hmtx"][name] = (advance, getattr(glyph, "xMin", 0))


def track(variable: TTFont, units: int) -> TTFont:
    """Add `units` of letter spacing to every spacing glyph, half each side, in every weight."""
    font = _editable(variable)
    glyf, hmtx = font["glyf"], font["hmtx"]
    for name in font.getGlyphOrder():
        glyph = glyf[name]
        if glyph.numberOfContours > 0:
            glyph.coordinates.translate((units // 2, 0))
    for name in font.getGlyphOrder():
        advance, _ = hmtx[name]
        if advance:
            hmtx[name] = (advance + units, 0)
        _refresh_lsb(font, name)
    return build.reload(font)


def _nearest(points: list[tuple[int, int]], target: tuple[int, int]) -> int:
    """Index of the existing point closest to a new one, whose weight deltas the new one borrows."""
    return min(range(len(points)), key=lambda i: (points[i][0] - target[0]) ** 2 + (points[i][1] - target[1]) ** 2)


def _add_rectangle(font: TTFont, name: str, box: tuple[int, int, int, int]) -> None:
    """Append a clockwise rectangle contour to a simple glyph; its points follow the nearest stem."""
    glyph, gvar = font["glyf"][name], font["gvar"]
    old = list(glyph.coordinates)
    x0, y0, x1, y1 = box
    corners = [(x0, y0), (x0, y1), (x1, y1), (x1, y0)]
    end_pts = list(glyph.endPtsOfContours)
    with_phantoms, controls = font["glyf"]._getCoordinatesAndControls(name, font["hmtx"].metrics)
    for variation in gvar.variations.get(name, []):
        variation.calcInferredDeltas(with_phantoms, controls.endPts)
        deltas = variation.coordinates
        borrowed = [deltas[_nearest(old, corner)] for corner in corners]
        variation.coordinates = deltas[: len(old)] + borrowed + deltas[len(old):]
    glyph.coordinates = GlyphCoordinates(old + corners)
    glyph.flags = bytearray(list(glyph.flags) + [1, 1, 1, 1])
    glyph.flags[0] |= flagOverlapSimple
    glyph.endPtsOfContours = end_pts + [len(old) + 3]
    glyph.numberOfContours += 1
    _refresh_lsb(font, name)


def tail_on_q(variable: TTFont) -> TTFont:
    """Break the p/q mirror the Atkinson way: a tail to the right at the foot of q's stem.

    Plex's b and d already carry a spur at the baseline, so q is the one mirror pair left.
    """
    font = _editable(variable)
    glyf = font["glyf"]
    stem = glyf["dotlessi"].xMax - glyf["dotlessi"].xMin
    glyph = glyf["q"]
    glyph.recalcBounds(glyf)
    box = (glyph.xMax - stem // 2, glyph.yMin, glyph.xMax + round(stem * 1.8), glyph.yMin + round(stem * 0.9))
    _add_rectangle(font, "q", box)
    return build.reload(font)


def dotted_zero(variable: TTFont) -> TTFont:
    """Plex's dotted zero (its ss04) as the default instead of the slashed one."""
    font = build.reload(variable)
    build.freeze_alternates(font, {"zero": "zero.alt01", "zero.tosf": "zero.tosf.alt01"})
    return build.reload(font)


def _place(font: TTFont, name: str, donor: TTFont, source: str, scale: float) -> None:
    """Copy one donor glyph (outline and weight variations) into the font, scaled to our metrics."""
    glyph = copy.deepcopy(donor["glyf"][source])
    glyph.coordinates.scale((scale, scale))
    variations = copy.deepcopy(donor["gvar"].variations[source])
    for variation in variations:
        variation.coordinates = [None if d is None else (round(d[0] * scale), round(d[1] * scale)) for d in variation.coordinates]
    font["glyf"][name] = glyph
    font["gvar"].variations[name] = variations
    advance = round(donor["hmtx"][source][0] * scale)
    font["hmtx"][name] = (advance if name != "one" else font["hmtx"][name][0], 0)
    if name == "one":  # keep the figure tabular: centre the borrowed 1 in our digit width
        glyph.recalcBounds(font["glyf"])
        glyph.coordinates.translate(((font["hmtx"][name][0] - (glyph.xMax - glyph.xMin)) // 2 - glyph.xMin, 0))
    _refresh_lsb(font, name)


HYBRID_GLYPHS = {"b": "b", "d": "d", "p": "p", "q": "q", "l": "l", "one": "one.tf"}


def atkinson_hybrid(variable: TTFont, cache: Path) -> TTFont:
    """Borrow Atkinson Hyperlegible Next's b d p q l 1, cut to the same 300-700 axis, scaled to our x-height."""
    donor = build.load(build.fetch(build.BASES["atkinson"].font, cache))
    donor = build.reload(instancer.instantiateVariableFont(donor, {"wght": (300, 700)}))
    font = _editable(variable)
    lower = font["OS/2"].sxHeight / donor["OS/2"].sxHeight
    caps = font["OS/2"].sCapHeight / donor["OS/2"].sCapHeight
    for name, source in HYBRID_GLYPHS.items():
        _place(font, name, donor, source, caps if name == "one" else lower)
    return build.reload(font)


# Where each aperture is opened: (glyph, [(x from, x to, y from, y to) as fractions of the glyph box]).
APERTURE_CUTS = {
    "c": [(0.86, 1.01, -0.01, 1.01)],
    "e": [(0.80, 1.01, -0.01, 0.36)],
    "s": [(0.86, 1.01, 0.62, 1.01), (-0.01, 0.14, -0.01, 0.38)],
    "a": [(-0.01, 0.16, 0.64, 1.01)],
}


def _box_path(glyph, cut: tuple[float, float, float, float]) -> pathops.Path:
    """A rectangle path covering one fraction of a glyph's bounding box."""
    x0, x1, y0, y1 = cut
    width, height = glyph.xMax - glyph.xMin, glyph.yMax - glyph.yMin
    left, right = glyph.xMin + x0 * width, glyph.xMin + x1 * width
    bottom, top = glyph.yMin + y0 * height, glyph.yMin + y1 * height
    path = pathops.Path()
    pen = path.getPen()
    pen.moveTo((left, bottom))
    pen.lineTo((left, top))
    pen.lineTo((right, top))
    pen.lineTo((right, bottom))
    pen.closePath()
    return path


def open_apertures(static: TTFont) -> TTFont:
    """Trim the terminals of c e s a so their openings are wider (static instances only)."""
    font = build.reload(static)
    glyphs = font.getGlyphSet()
    for name, cuts in APERTURE_CUTS.items():
        glyph = font["glyf"][name]
        glyph.recalcBounds(font["glyf"])
        path = pathops.Path()
        glyphs[name].draw(path.getPen(glyphSet=glyphs))
        for cut in cuts:
            path = pathops.op(path, _box_path(glyph, cut), pathops.PathOp.DIFFERENCE)
        pen = TTGlyphPen(None)
        path.draw(Cu2QuPen(pen, max_err=1, reverse_direction=False))
        font["glyf"][name] = pen.glyph()
        _refresh_lsb(font, name)
    return build.reload(font)


def heavier_regular(variable: TTFont, wght: int = 440) -> TTFont:
    """A Regular instance at a heavier weight, for low contrast and cheap screens."""
    return instancer.instantiateVariableFont(build.reload(variable), {"wght": wght})
