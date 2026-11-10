"""The pinned font sources MedBrains Sans can be built from, and what each one needs changed.

Every base is under the SIL Open Font License 1.1, pinned by URL and SHA-256 so a build is
reproducible. `build_medbrains_sans.py --base KEY` selects one; IBM Plex Sans stays the default
until the owner picks (docs/design/fonts/MEDBRAINS-SANS.md, round 2).
"""

from __future__ import annotations

import hashlib
import io
import urllib.request
import zipfile
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Source:
    """A pinned download; `member` names the file inside it when it is a zip archive."""

    url: str
    sha256: str
    member: str | None = None


@dataclass(frozen=True)
class Base:
    """One upstream family and the clinical defaults MedBrains Sans needs from it."""

    label: str
    font: Source
    licence: Source
    release: str
    commit: str
    copyright: str
    designers: str
    description: str
    # Axis limits that cut the upstream variable font to an upright, normal-width 300-700 range.
    axes: dict[str, object]
    # Upstream PostScript prefixes, replaced by ours in instance and axis names.
    ps_names: tuple[str, ...]
    # The licence's Reserved Font Name, if any: the build fails if a name record keeps it.
    reserved: str | None
    # Features whose single substitutions are frozen into the cmap, in order.
    freeze: tuple[str, ...] = ()
    # Glyph outlines copied over their defaults instead (keeps the glyph name and its kerning).
    copy_alternates: dict[str, str] = field(default_factory=dict)
    tabular: bool = True
    gaps: str = ""
    # MedBrains Sans' easy-read changes (accessible.py), applied in every weight.
    hybrid: bool = False
    tracking: int = 0
    # The wght the "Regular" static files are cut at (web gets it from CSS font-weight).
    regular_wght: int = 400
    # Copyright lines of other fonts whose glyphs are mixed in, for OFL.txt.
    credits: tuple[str, ...] = ()


def fetch(source: Source, cache: Path) -> bytes:
    """A pinned file, downloaded once and refused unless its SHA-256 matches the pin."""
    suffix = ".zip" if source.member else Path(source.url).suffix
    path = cache / f"{source.sha256[:16]}{suffix}"
    if not path.exists():
        cache.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(source.url, timeout=120) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if digest != source.sha256:
        raise SystemExit(f"{source.url}: sha256 {digest} is not the pinned {source.sha256}")
    if source.member is None:
        return data
    return zipfile.ZipFile(io.BytesIO(data)).read(source.member)


ATKINSON_COPYRIGHT = (
    "Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors "
    "(https://github.com/googlefonts/atkinson-hyperlegible-next)."
)
ATKINSON_DESIGNERS = "Elliott Scott, Megan Eiswerth, Linus Boman, Theodore Petrosky, Letters from Sweden (Atkinson Hyperlegible Next)"
_PLEX_ZIP = "https://github.com/IBM/plex/releases/download/%40ibm/plex-sans-variable%400.2.0/plex-sans-variable.zip"
_PLEX_SHA = "f83825d527be6cd39c8971c932b9bf22688a3ad3e5ac6305b6143d02f52b87b6"
_ATKINSON = "https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/7925f50f649b3813257faf2f4c0b381011f434f1/"
_LEXEND = "https://raw.githubusercontent.com/googlefonts/lexend/7894f02b2e7eabc48595f1d4eff3b17b48c6e651/"
_INTER_ZIP = "https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip"
_INTER_SHA = "9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e"

BASES = {
    "plex": Base(
        label="IBM Plex Sans 3.000",
        font=Source(_PLEX_ZIP, _PLEX_SHA, "fonts/complete/ttf/IBM Plex Sans Var-Roman.ttf"),
        licence=Source(_PLEX_ZIP, _PLEX_SHA, "fonts/complete/ttf/license.txt"),
        release="@ibm/plex-sans-variable@0.2.0",
        commit="348dbb6121c34d755a6d2725c89b2abc9ffaa142",
        copyright=f"Copyright 2019 IBM Corp. All rights reserved. {ATKINSON_COPYRIGHT}",
        designers=f"Mike Abbink, Paul van der Laan, Pieter van Rosmalen (IBM Plex Sans); {ATKINSON_DESIGNERS}: b d p q l 1",
        description=(
            "Derived from IBM Plex Sans with b d p q l 1 from Atkinson Hyperlegible Next: slashed zero, "
            "wider spacing and a heavier Regular, for easy clinical reading."
        ),
        axes={"wght": (300, 700), "wdth": 100},
        ps_names=("IBMPlexSansVarRoman", "IBMPlexSansVar"),
        reserved="Plex",
        copy_alternates={"zero": "zero.alt02", "zero.tosf": "zero.tosf.alt02"},
        hybrid=True,
        tracking=12,
        regular_wght=440,
        credits=(ATKINSON_COPYRIGHT,),
    ),
    "atkinson": Base(
        label="Atkinson Hyperlegible Next 2.001",
        font=Source(_ATKINSON + "fonts/variable/AtkinsonHyperlegibleNext%5Bwght%5D.ttf",
                    "5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745"),
        licence=Source(_ATKINSON + "OFL.txt", "aca6a428580965d2297d1b718042dd427c2a9443ece3b0d02d758e161e0c4030"),
        release="googlefonts/atkinson-hyperlegible-next",
        commit="7925f50f649b3813257faf2f4c0b381011f434f1",
        copyright=ATKINSON_COPYRIGHT,
        designers=ATKINSON_DESIGNERS,
        description="Derived from Atkinson Hyperlegible Next: tabular figures by default, for clinical text.",
        axes={"wght": (300, 700)},
        ps_names=("AtkinsonHyperlegibleNext",),
        reserved=None,
        freeze=("tnum",),
    ),
    "inter": Base(
        label="Inter 4.1",
        font=Source(_INTER_ZIP, _INTER_SHA, "InterVariable.ttf"),
        licence=Source(_INTER_ZIP, _INTER_SHA, "LICENSE.txt"),
        release="rsms/inter v4.1",
        commit="e3a3d4c57d5ecc01453a575621882a384c1995a3",
        copyright="Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter).",
        designers="Rasmus Andersson (Inter)",
        description="Derived from Inter: tabular figures, slashed zero, serifed I and tailed l by default.",
        axes={"wght": (300, 700), "opsz": 14},
        ps_names=("InterVariable", "Inter"),
        reserved=None,
        freeze=("tnum", "ss02"),
    ),
    "lexend": Base(
        label="Lexend 1.008",
        font=Source(_LEXEND + "fonts/lexend/variable/Lexend%5BHEXP,wght%5D.ttf",
                    "e59ed08278bad676e9ee6a4c1761b118775d7ed21e9e87fc3d5fec9721579743"),
        licence=Source(_LEXEND + "OFL.txt", "5da8505887d0fa7fe963445fd58852707fda34adfeb65af25c99d152bab285bd"),
        release="googlefonts/lexend",
        commit="7894f02b2e7eabc48595f1d4eff3b17b48c6e651",
        copyright="Copyright 2018 The Lexend Project Authors (https://github.com/googlefonts/lexend).",
        designers="Bonnie Shaver-Troup, Thomas Jockin (Lexend)",
        description="Derived from Lexend: distinct zero and serifed I by default.",
        axes={"wght": (300, 700), "HEXP": 0},
        ps_names=("Lexend",),
        reserved="RevReading Lexend",
        freeze=("zero", "ss01"),
        tabular=False,
        gaps="no tabular figures (Lexend has no tnum); l has no tail",
    ),
}

NOTO = {
    "Devanagari": (
        Source(
            "https://github.com/notofonts/devanagari/releases/download/NotoSansDevanagari-v2.007/NotoSansDevanagari-v2.007.zip",
            "820c7da45b1e63562cb41c0a8cac5d9a4202312043a3a040ed1325857ef469b1",
            "NotoSansDevanagari/unhinted/slim-variable-ttf/NotoSansDevanagari[wght].ttf",
        ),
        "OFL.txt",
    ),
    "Tamil": (
        Source(
            "https://github.com/notofonts/tamil/releases/download/NotoSansTamil-v2.004/NotoSansTamil-v2.004.zip",
            "f8284e0f200a7f29a439b4ec88280d864b2b31f8479111c5b658ba6da38b3005",
            "NotoSansTamil/unhinted/slim-variable-ttf/NotoSansTamil[wght].ttf",
        ),
        "../OFL.txt",
    ),
}
