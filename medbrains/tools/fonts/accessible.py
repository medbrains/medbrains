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
from fontTools.otlLib.builder import buildLookup, buildPairPosGlyphs, buildValue
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates, flagOverlapSimple
from fontTools.ttLib.tables.TupleVariation import TupleVariation
from fontTools.varLib import instancer
from fontTools.varLib.hvar import add_HVAR

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
    """Copy one donor glyph (outline, advance and weight variations) in, scaled to our metrics."""
    glyph = copy.deepcopy(donor["glyf"][source])
    glyph.coordinates.scale((scale, scale))
    variations = copy.deepcopy(donor["gvar"].variations[source])
    for variation in variations:
        variation.coordinates = [None if d is None else (round(d[0] * scale), round(d[1] * scale)) for d in variation.coordinates]
    font["glyf"][name] = glyph
    font["gvar"].variations[name] = variations
    font["hmtx"][name] = (round(donor["hmtx"][source][0] * scale), 0)
    _refresh_lsb(font, name)


HYBRID_GLYPHS = {"b": "b", "d": "d", "p": "p", "q": "q", "l": "l", "one": "one.tf"}
# The weights the borrowed glyphs are fitted at: the axis ends and the default.
FIT_WEIGHTS = {300: (-1.0, -1.0, 0.0), 400: None, 700: (0.0, 1.0, 1.0)}


def _metrics_at(font: TTFont, wght: int) -> dict[str, tuple[int, int, int]]:
    """(xMin, xMax, advance) of each borrowed glyph at one weight, read from an instance."""
    instance = instancer.instantiateVariableFont(build.reload(font), {"wght": wght})
    out = {}
    for name in HYBRID_GLYPHS:
        glyph = instance["glyf"][name]
        glyph.recalcBounds(instance["glyf"])
        out[name] = (glyph.xMin, glyph.xMax, instance["hmtx"][name][0])
    return out


# Which side keeps Plex's side bearing: the stem side, so stems sit where Plex's do. q follows d
# (same bowl and stem, plus a tail that overhangs to the right as Atkinson drew it).
STEM_SIDE = {"b": "left", "p": "left", "d": "right", "q": "d", "l": "split", "one": "centre"}


def _targets(plex: dict, borrowed: dict) -> dict[str, tuple[float, int]]:
    """Where each borrowed glyph's ink starts, and its advance, at one weight.

    The advance is always Plex's, so the rhythm of a line is unchanged. The stem side keeps Plex's
    side bearing and the bowl side absorbs the difference in width; l splits it; the tabular 1 is
    centred by its ink.
    """
    out: dict[str, tuple[float, int]] = {}
    for name in ("b", "p", "d", "l", "one", "q"):
        x_min, x_max, advance = borrowed[name]
        p_min, p_max, p_advance = plex[name]
        side = STEM_SIDE[name]
        if side == "left":
            start = p_min
        elif side == "right":
            start = p_max - (x_max - x_min)
        elif side == "d":
            start = x_min + (out["d"][0] - borrowed["d"][0])
        elif side == "centre":
            start = (p_advance - (x_max - x_min)) / 2
        else:
            start = x_min + (p_advance - advance) / 2
        out[name] = (start, p_advance)
    return out


def _fit(font: TTFont, plex_font: TTFont) -> None:
    """Fit the borrowed glyphs to Plex's spacing at every weight, not only at the default."""
    targets = {w: _targets(_metrics_at(plex_font, w), _metrics_at(font, w)) for w in FIT_WEIGHTS}
    current = _metrics_at(font, 400)
    for name, (x_min, advance) in targets[400].items():
        font["glyf"][name].coordinates.translate((round(x_min - current[name][0]), 0))
        font["hmtx"][name] = (advance, 0)
        _refresh_lsb(font, name)
    for wght, region in FIT_WEIGHTS.items():
        if region is None:
            continue
        current = _metrics_at(font, wght)
        for name, (x_min, advance) in targets[wght].items():
            shift, widen = round(x_min - current[name][0]), advance - current[name][2]
            points = len(font["glyf"][name].coordinates)
            deltas = [(shift, 0)] * points + [(0, 0), (widen, 0), (0, 0), (0, 0)]
            font["gvar"].variations[name].append(TupleVariation({"wght": region}, deltas))


# Atkinson's q has a tail that overhangs to the right; these neighbours reach under it.
# check_glyph_collisions.py measured the worst overlap at 45 units (q) at wght 700.
Q_TAIL_CLEARANCE = 60
Q_TAIL_NEIGHBOURS = ("parenright", "slash", "j", "underscore", "g")


def _kern_apart(font: TTFont, left: str, rights: tuple[str, ...], value: int) -> None:
    """Add a kern lookup that pushes `left` and each of `rights` apart by `value`, at every weight."""
    pairs = {(left, right): (buildValue({"XAdvance": value}), None) for right in rights}
    lookup = buildLookup(buildPairPosGlyphs(pairs, font.getReverseGlyphMap()))
    gpos = font["GPOS"].table
    gpos.LookupList.Lookup.append(lookup)
    gpos.LookupList.LookupCount = len(gpos.LookupList.Lookup)
    index = gpos.LookupList.LookupCount - 1
    for record in gpos.FeatureList.FeatureRecord:
        if record.FeatureTag == "kern":
            record.Feature.LookupListIndex.append(index)
            record.Feature.LookupCount = len(record.Feature.LookupListIndex)


def atkinson_hybrid(variable: TTFont, cache: Path) -> TTFont:
    """Borrow Atkinson Hyperlegible Next's b d p q l 1 into every weight, fitted to Plex's spacing.

    Atkinson is cut to the same 300-700 axis so its weight deltas line up with ours, scaled to our
    x-height (the 1 to our cap height), then fitted at 300, 400 and 700. Advance widths come from
    gvar's phantom points while editing; HVAR is rebuilt from them at the end.
    """
    donor = build.load(build.fetch(build.BASES["atkinson"].font, cache))
    donor = build.reload(instancer.instantiateVariableFont(donor, {"wght": (300, 700)}))
    font = _editable(variable)
    del font["HVAR"]
    lower = font["OS/2"].sxHeight / donor["OS/2"].sxHeight
    caps = font["OS/2"].sCapHeight / donor["OS/2"].sCapHeight
    for name, source in HYBRID_GLYPHS.items():
        _place(font, name, donor, source, caps if name == "one" else lower)
    plex_font = build.reload(variable)
    del plex_font["HVAR"]
    _fit(font, plex_font)
    _kern_apart(font, "q", Q_TAIL_NEIGHBOURS, Q_TAIL_CLEARANCE)
    add_HVAR(font)
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
