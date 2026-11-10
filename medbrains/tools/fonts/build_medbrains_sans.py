#!/usr/bin/env python3
"""Build MedBrains Sans from a pinned IBM Plex Sans release, plus its Noto pairing for Indian scripts.

MedBrains Sans is IBM Plex Sans with its clinical alternate (the slashed zero) made the default, so a
dose or an ID reads the same in every app, including ones that cannot switch OpenType features on.
Plex is under the SIL Open Font License 1.1 with the Reserved Font Name "Plex", so the derived font
carries a new name and keeps IBM's copyright and the licence. See docs/design/fonts/MEDBRAINS-SANS.md.

Outputs, all committed:
- web: one variable WOFF2 (weights 400-700) per unicode range, Latin first, so a page downloads only
  what it draws; Noto Sans Devanagari and Tamil as extra faces of the same family; fonts.css with the
  faces and a metric-matched system fallback that keeps text from jumping when the font arrives;
- iOS, Android and the GTK shell: one Latin static TTF per weight, unhinted.

    python3 -I tools/fonts/build_medbrains_sans.py            # build and install into the repo
    python3 -I tools/fonts/build_medbrains_sans.py --check    # fail if the committed files differ

Needs the versions in tools/fonts/requirements.txt (`make fonts` / `make check-fonts` set that up).
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import io
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables import ttProgram
from fontTools.varLib import instancer


@dataclass(frozen=True)
class Source:
    """A pinned release archive, the font inside it and its licence file."""

    url: str
    sha256: str
    member: str
    licence: str


PLEX = Source(
    url="https://github.com/IBM/plex/releases/download/%40ibm/plex-sans-variable%400.2.0/plex-sans-variable.zip",
    sha256="f83825d527be6cd39c8971c932b9bf22688a3ad3e5ac6305b6143d02f52b87b6",
    member="fonts/complete/ttf/IBM Plex Sans Var-Roman.ttf",
    licence="fonts/complete/ttf/license.txt",
)
PLEX_RELEASE = "@ibm/plex-sans-variable@0.2.0"
PLEX_COMMIT = "348dbb6121c34d755a6d2725c89b2abc9ffaa142"
NOTO = {
    "Devanagari": Source(
        url="https://github.com/notofonts/devanagari/releases/download/NotoSansDevanagari-v2.007/NotoSansDevanagari-v2.007.zip",
        sha256="820c7da45b1e63562cb41c0a8cac5d9a4202312043a3a040ed1325857ef469b1",
        member="NotoSansDevanagari/unhinted/slim-variable-ttf/NotoSansDevanagari[wght].ttf",
        licence="OFL.txt",
    ),
    "Tamil": Source(
        url="https://github.com/notofonts/tamil/releases/download/NotoSansTamil-v2.004/NotoSansTamil-v2.004.zip",
        sha256="f8284e0f200a7f29a439b4ec88280d864b2b31f8479111c5b658ba6da38b3005",
        member="NotoSansTamil/unhinted/slim-variable-ttf/NotoSansTamil[wght].ttf",
        licence="../OFL.txt",
    ),
}

FAMILY = "MedBrains Sans"
PS_FAMILY = "MedBrainsSans"
VERSION = "0.100"
VENDOR = "MDBR"
OUR_COPYRIGHT = "Copyright 2026 Domnic Amalan S and MedBrains contributors (MedBrains Sans changes)."
IBM_COPYRIGHT = "Copyright 2019 IBM Corp. All rights reserved."
OFL_NOTICE = (
    "This Font Software is licensed under the SIL Open Font License, Version 1.1. "
    "This license is available with a FAQ at: https://openfontlicense.org"
)
# Name IDs allowed to mention Plex: designers, version (the source) and description (the lineage).
PLEX_MENTION_OK = {5, 9, 10}

# Static instances for native and GTK: weight name -> (wght, one of the four RIBBI styles?).
STATICS = {"Light": (300, False), "Regular": (400, True), "Medium": (500, False), "SemiBold": (600, False)}
NATIVE_WEIGHTS = ("Light", "Regular", "Medium", "SemiBold")
GTK_WEIGHTS = ("Regular", "SemiBold")
WEB_WGHT = (400, 700)

# Plex's slashed zero (stylistic set ss03 / feature `zero`), frozen into the default glyphs.
FROZEN_ALTERNATES = {"zero": "zero.alt02", "zero.tosf": "zero.tosf.alt02"}
DIGITS = ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")

# The first-load face: ASCII, Latin-1 (µ ° ± × ÷ ² ³ ½ live here), the clinical symbols ≤ ≥ → ₹
# and typographic punctuation. ZWJ/ZWNJ (U+200C-200F) are left to the Indic faces, which need them
# in the same run to shape conjuncts.
LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-200B,U+2010-206F,"
    "U+20AC,U+20B9,U+2122,U+2190-2193,U+2212,U+2215,U+2264-2265,U+FEFF,U+FFFD"
)
INDIC_RANGES = {
    "Devanagari": "U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+25CC,U+A830-A839,U+A8E0-A8FF",
    "Tamil": "U+0B80-0BFF,U+11FC0-11FFF,U+200C-200D,U+25CC",
}

# Arial's metrics, for the fallback face (Arial ships on Windows and macOS; Liberation Sans is its
# metric clone on Linux), in em. Measured from Arial 5.01 with average_width() below; CI has no Arial.
ARIAL_AVG_WIDTH = 0.44088
# English letter frequencies (per mille) and the space, to weight the average glyph width.
LETTER_FREQ = dict(
    zip(
        "etaoinshrdlcumwfgypbvkjxqz ",
        (102, 74, 66, 63, 58, 55, 51, 50, 48, 34, 33, 22, 22, 20, 19, 18, 16, 16, 15, 12, 8, 6, 1, 1, 1, 1, 180),
        strict=True,
    )
)

REPO = Path(__file__).resolve().parents[3]
WEB_DIR = REPO / "medbrains/packages/design-system/src/assets/fonts"
FONTS_CSS = REPO / "medbrains/packages/design-system/src/styles/fonts.css"
IOS_DIR = REPO / "medbrains/apps/ios/Packages/MedBrainsUI/Sources/MedBrainsUI/Fonts"
ANDROID_DIR = REPO / "medbrains/apps/android/ui/src/main/res/font"
ANDROID_LICENSE_DIR = REPO / "medbrains/apps/android/ui/src/main/assets/licenses"
GTK_DIR = REPO / "medbrains/crates/medbrains-shell/fonts"

CSS_HEADER = """/* MedBrains Sans, generated by tools/fonts/build_medbrains_sans.py: never edit by hand.
   IBM Plex Sans with the slashed zero by default, plus Noto Sans Devanagari and Tamil as faces of the
   same family, matched in size (SIL OFL 1.1, see ../assets/fonts/OFL*.txt). Each face downloads only
   when a page draws a character in its unicode-range; index.html preloads the Latin face.
   "MedBrains Sans Fallback" is local Arial resized to the same metrics, so text does not move when
   the web font arrives. */"""


def fetch(source: Source, cache: Path) -> zipfile.ZipFile:
    """Download a pinned release once and refuse it unless its SHA-256 matches the pin."""
    archive = cache / f"{source.sha256[:16]}.zip"
    if not archive.exists():
        cache.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(source.url, timeout=120) as response:
            archive.write_bytes(response.read())
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    if digest != source.sha256:
        raise SystemExit(f"{source.url}: sha256 {digest} is not the pinned {source.sha256}")
    return zipfile.ZipFile(archive)


def to_bytes(font: TTFont, flavor: str | None = None) -> bytes:
    """Serialise a font without stamping the build time, so rebuilding gives identical bytes."""
    out = io.BytesIO()
    font.flavor = flavor
    font.save(out, reorderTables=True)
    return out.getvalue()


def load(data: bytes) -> TTFont:
    """A fully loaded font whose save keeps the source's timestamps."""
    return TTFont(io.BytesIO(data), recalcTimestamp=False, lazy=False)


def reload(font: TTFont) -> TTFont:
    """A fresh copy; instancer and subsetter both change the font they are given."""
    return load(to_bytes(font))


def freeze_alternates(font: TTFont) -> None:
    """Copy each clinical alternate over its default glyph, outline and variations both."""
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"]
    for default, alternate in FROZEN_ALTERNATES.items():
        if hmtx[default][0] != hmtx[alternate][0]:
            raise SystemExit(f"{alternate} would change the advance of {default}")
        glyf[default] = copy.deepcopy(glyf[alternate])
        gvar.variations[default] = copy.deepcopy(gvar.variations[alternate])


def assert_tabular_digits(font: TTFont) -> None:
    """Fail the build unless every default digit shares one advance width: tables of doses align."""
    widths = {font["hmtx"][digit][0] for digit in DIGITS}
    if len(widths) != 1:
        raise SystemExit(f"default digits are not tabular: advances {sorted(widths)}")


def name_records(weight: str, ribbi: bool) -> dict[int, str]:
    """The name table entries for one style; RIBBI styles need no typographic family pair."""
    ps_name = f"{PS_FAMILY}-{weight}"
    records = {
        0: f"{IBM_COPYRIGHT} {OUR_COPYRIGHT}",
        1: FAMILY if ribbi else f"{FAMILY} {weight}",
        2: weight if ribbi else "Regular",
        3: f"{VERSION};{VENDOR};{ps_name}",
        4: FAMILY if weight == "Regular" else f"{FAMILY} {weight}",
        5: f"Version {VERSION}; from IBM Plex Sans 3.000 ({PLEX_RELEASE}, commit {PLEX_COMMIT[:12]})",
        6: ps_name,
        8: "MedBrains",
        9: "Mike Abbink, Paul van der Laan, Pieter van Rosmalen (IBM Plex Sans); MedBrains (changes)",
        10: "Derived from IBM Plex Sans: the slashed zero is the default figure, for clinical text.",
        11: "https://www.medbrains.in",
        13: OFL_NOTICE,
        14: "https://openfontlicense.org",
    }
    if not ribbi:
        records.update({16: FAMILY, 17: weight})
    return records


def rename(font: TTFont, weight: str, ribbi: bool) -> None:
    """Replace every name that says Plex (a Reserved Font Name); keep the feature and axis labels."""
    table = font["name"]
    table.names = [record for record in table.names if record.nameID >= 19]
    for record in table.names:
        text = record.toUnicode().replace("IBMPlexSansVarRoman", PS_FAMILY)
        record.string = text.replace("IBMPlexSansVar", PS_FAMILY)
    for name_id, text in name_records(weight, ribbi).items():
        table.setName(text, name_id, 3, 1, 0x409)
    if any("Plex" in r.toUnicode() for r in table.names if r.nameID not in PLEX_MENTION_OK):
        raise SystemExit("a name record still says Plex, a Reserved Font Name")
    font["OS/2"].achVendID = VENDOR
    font["head"].fontRevision = float(VERSION)


def medbrains_variable(plex: zipfile.ZipFile) -> TTFont:
    """Plex Sans' upright cut to normal width and weights 300-700, alternate frozen, renamed."""
    font = load(plex.read(PLEX.member))
    font["head"].modified = font["head"].created
    font = instancer.instantiateVariableFont(font, {"wght": (300, 700), "wdth": 100})
    freeze_alternates(font)
    assert_tabular_digits(font)
    rename(font, "Regular", True)
    return reload(font)


def static_instance(variable: TTFont, weight: str) -> TTFont:
    """One static weight, named as its own style, for platforms that register fonts by weight."""
    wght, ribbi = STATICS[weight]
    font = instancer.instantiateVariableFont(reload(variable), {"wght": wght})
    font["OS/2"].usWeightClass = wght
    rename(font, weight, ribbi)
    return font


def cut(font: TTFont, unicodes: str | list[int], hinting: bool) -> TTFont:
    """The font reduced to some characters, every OpenType feature kept (zero, ss01-ss06, ...)."""
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.hinting = hinting
    options.drop_tables += ["meta", "DSIG"]
    subsetter = subset.Subsetter(options)
    codes = subset.parse_unicodes(unicodes) if isinstance(unicodes, str) else unicodes
    subsetter.populate(unicodes=codes)
    clone = reload(font)
    subsetter.subset(clone)
    return clone


SMART_DROPOUT = ["PUSHW[]", "511", "SCANCTRL[]", "PUSHB[]", "4", "SCANTYPE[]"]


def smart_dropout(font: TTFont) -> TTFont:
    """Turn on smart dropout control ahead of any hinting, so small sizes keep their thin stems."""
    existing = font["prep"].program.getAssembly() if "prep" in font else []
    prep = newTable("prep")
    prep.program = ttProgram.Program()
    prep.program.fromAssembly(SMART_DROPOUT + existing)
    font["prep"] = prep
    if existing:
        return font  # a hinted font keeps its own gasp table
    gasp = newTable("gasp")
    gasp.gaspRange = {0xFFFF: 0x000F}
    font["gasp"] = gasp
    font["maxp"].maxStackElements = max(font["maxp"].maxStackElements, 2)
    return font


def unicode_range(codes: list[int]) -> str:
    """CSS unicode-range for a set of code points, consecutive runs merged."""
    spans: list[list[int]] = []
    for code in sorted(codes):
        if spans and code == spans[-1][1] + 1:
            spans[-1][1] = code
        else:
            spans.append([code, code])
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in spans)


def average_width(font: TTFont) -> float:
    """Advance width over English letter frequencies, in em: the basis of the fallback's size-adjust."""
    cmap, hmtx = font.getBestCmap(), font["hmtx"]
    total = sum(LETTER_FREQ.values()) * font["head"].unitsPerEm
    return sum(hmtx[cmap[ord(char)]][0] * weight for char, weight in LETTER_FREQ.items()) / total


def fallback_face(font: TTFont) -> str:
    """A local Arial face resized and re-spaced to MedBrains Sans' metrics: no shift on swap."""
    upm, hhea = font["head"].unitsPerEm, font["hhea"]
    adjust = average_width(font) / ARIAL_AVG_WIDTH

    def pct(value: int) -> str:
        """A vertical metric as the percentage CSS wants once size-adjust has scaled the face."""
        return f"{value / upm / adjust * 100:.2f}%"

    return (
        '@font-face { font-family: "MedBrains Sans Fallback"; '
        'src: local("Arial"), local("ArialMT"), local("Liberation Sans"), local("Helvetica"); '
        f"size-adjust: {adjust * 100:.2f}%; ascent-override: {pct(hhea.ascent)}; "
        f"descent-override: {pct(-hhea.descent)}; line-gap-override: {pct(hhea.lineGap)}; }}"
    )


def face(file: str, codes: list[int]) -> str:
    """One @font-face of the MedBrains Sans family: a variable WOFF2 for one unicode range."""
    return (
        f'@font-face {{ font-family: "{FAMILY}"; font-style: normal; '
        f"font-weight: {WEB_WGHT[0]} {WEB_WGHT[1]}; font-display: swap; "
        f'src: url("../assets/fonts/{file}") format("woff2"); unicode-range: {unicode_range(codes)}; }}'
    )


def web_outputs(variable: TTFont, noto: dict[str, TTFont]) -> dict[Path, bytes]:
    """The web WOFF2 files (hinted Latin for low-DPI screens) and the stylesheet declaring them."""
    web = instancer.instantiateVariableFont(reload(variable), {"wght": WEB_WGHT})
    latin = smart_dropout(cut(web, LATIN, hinting=True))
    latin_codes = sorted(latin.getBestCmap())
    rest = sorted(set(web.getBestCmap()) - set(latin_codes) - set(range(0x200C, 0x2010)))
    files = {
        WEB_DIR / f"{PS_FAMILY}-latin.woff2": to_bytes(latin, "woff2"),
        WEB_DIR / f"{PS_FAMILY}-extended.woff2": to_bytes(smart_dropout(cut(web, rest, hinting=True)), "woff2"),
    }
    css = [CSS_HEADER, fallback_face(web)]
    for script, font in noto.items():
        files[WEB_DIR / f"NotoSans{script}.woff2"] = to_bytes(font, "woff2")
        css.append(face(f"NotoSans{script}.woff2", sorted(font.getBestCmap())))
    css += [face(f"{PS_FAMILY}-extended.woff2", rest), face(f"{PS_FAMILY}-latin.woff2", latin_codes)]
    files[FONTS_CSS] = ("\n".join(css) + "\n").encode()
    return files


def noto_faces(cache: Path) -> tuple[dict[str, TTFont], bytes]:
    """Noto Sans Devanagari and Tamil cut to their scripts and weights 400-700, plus their licences."""
    fonts, licences = {}, []
    for script, source in NOTO.items():
        archive = fetch(source, cache)
        font = instancer.instantiateVariableFont(load(archive.read(source.member)), {"wght": WEB_WGHT})
        fonts[script] = cut(font, INDIC_RANGES[script], hinting=False)
        licences.append(archive.read(source.licence).decode("utf-8").replace("\r", ""))
    return fonts, "\n\n".join(licences).encode()


def outputs(cache: Path) -> dict[Path, bytes]:
    """Every file the build installs, keyed by its path in the repository."""
    plex = fetch(PLEX, cache)
    variable = medbrains_variable(plex)
    noto, noto_licence = noto_faces(cache)
    files = web_outputs(variable, noto)
    for weight in NATIVE_WEIGHTS:
        data = to_bytes(smart_dropout(cut(static_instance(variable, weight), LATIN, hinting=False)))
        files[IOS_DIR / f"{PS_FAMILY}-{weight}.ttf"] = data
        files[ANDROID_DIR / f"medbrains_sans_{weight.lower()}.ttf"] = data
        if weight in GTK_WEIGHTS:
            files[GTK_DIR / f"{PS_FAMILY}-{weight}.ttf"] = data
    for script, font in noto.items():
        files[GTK_DIR / f"NotoSans{script}.ttf"] = to_bytes(smart_dropout(reload(font)))
    ibm = plex.read(PLEX.licence).decode("utf-8").replace("\r", "")
    for directory in (WEB_DIR, IOS_DIR, ANDROID_LICENSE_DIR, GTK_DIR):
        files[directory / "OFL.txt"] = f"{OUR_COPYRIGHT}\n{ibm}".encode()
    for directory in (WEB_DIR, GTK_DIR):
        files[directory / "OFL-Noto.txt"] = noto_licence
    return files


def stale(files: dict[Path, bytes]) -> list[Path]:
    """The committed files that are missing or differ from this build's output."""
    return [path for path, data in files.items() if not path.exists() or path.read_bytes() != data]


def main() -> int:
    """Build, then either install into the repository or check the committed copies match."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if committed fonts differ")
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache/medbrains-fonts")
    args = parser.parse_args()
    files = outputs(args.cache)
    if args.check:
        drift = stale(files)
        for path in drift:
            print(f"out of date: {path.relative_to(REPO)} (run `make fonts`)", file=sys.stderr)
        return 1 if drift else 0
    for path, data in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f"{len(data):>8}  {path.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
