# MedBrains Sans

**Status: shipped (owner, 2026-11-10).** MedBrains Sans is the interface font of every MedBrains
surface: the web app, the docs site, the marketing website, the Kanidm sign-in page, iOS, Android
and the GTK desktop shell. It is IBM Plex Sans made easy to read, built in code from pinned
sources. IBM Plex Mono and Archivo stay as they are.

Review sheets:

- [`medbrains-sans-easy-read.png`](medbrains-sans-easy-read.png) (`.pdf`): v0, the round-2 mix and
  the shipped easy-read mix side by side, light and dark: mirror letters, a low-vision blur test, a
  patient instruction and clinical lines at 12/14/16/24 px.
- [`medbrains-sans-v0-samples.png`](medbrains-sans-v0-samples.png) (`.pdf`, one page per weight):
  IBM Plex Sans against MedBrains Sans for doses, IDs, lab values, confusables, look-alike drug
  names and Hindi.

## What it is

| Change from IBM Plex Sans | How |
|---|---|
| Slashed zero by default | Plex's `zero.alt02` outline and weight variations copied over `zero` (and `zero.tosf`), so 0 and O differ even in apps that cannot turn features on |
| b d p q l 1 from Atkinson Hyperlegible Next | The Braille Institute's low-vision designs: no mirror pairs (q has a tail), a tailed l, a flagged 1. Atkinson is cut to the same 300-700 axis so its weight deltas line up, scaled to Plex's x-height (the 1 to the cap height) and fitted to Plex's spacing at 300, 400 and 700: Plex's advance at each weight, the stem side keeps Plex's side bearing, the 1 is centred in the tabular width. HVAR is rebuilt from the fitted glyphs |
| q kerned clear of ) / j _ g | Atkinson's q tail overhangs to the right; a kern lookup adds 60 units before those five glyphs. `check_glyph_collisions.py` shapes every borrowed glyph against all printable ASCII, both orders, at 400/440/550/700, and fails on any ink overlap |
| Letter spacing +12 units | Every spacing glyph, half on each side, all weights |
| Regular at weight 440 | Web: `fontWeight.regular` is 440 and body text uses it (also the docs site, the website and Kanidm). Native and GTK: the Regular file is cut at 440 (still registered as weight 400) |
| Tabular figures | Already Plex's default (every digit 600 units, 612 with the spacing); the build fails if a digit width ever differs |

Plex's GSUB was inspected: ss01 single-storey a, ss02 single-storey g, ss03/`zero` slashed zero
(used), ss04 dotted zero (still available), ss05 alternate ß, ss06 Bulgarian Cyrillic. Opening the
apertures of c e s a was tried in code but works only on static files (a boolean cut breaks
interpolation), so it is left for a type designer. Bigger text for people who need it comes from
the OS and browser text-size settings, which every surface honours through relative sizes; a
per-person larger-text setting can come later.

## Licence and credits

Both sources are under the SIL Open Font License 1.1, so the mix is a Modified Version of both,
released under the OFL:

- IBM Plex has the Reserved Font Name "Plex"; Atkinson Hyperlegible Next has none. No name record
  says Plex except the copyright, the version, the designers and the description; the build fails
  if any other record does. The family is MedBrains Sans (PostScript `MedBrainsSans-*`).
- The copyright record holds IBM's line, the Atkinson Hyperlegible Next Project Authors' line and
  ours; the designer record names both teams (Mike Abbink, Paul van der Laan, Pieter van Rosmalen
  for Plex; Elliott Scott, Megan Eiswerth, Linus Boman, Theodore Petrosky, Letters from Sweden for
  Atkinson Hyperlegible Next).
- `OFL.txt` (our line, Atkinson's line, then IBM's licence text with its RFN line) sits next to every
  copy: the web assets, the docs site and website `src/fonts`, the iOS `Fonts` folder,
  `apps/android/ui/src/main/assets/licenses` and the GTK shell's `fonts`. The Noto faces carry
  `OFL-Noto.txt`.

## Sources

Pinned by commit and SHA-256 in `tools/fonts/bases.py`; the build refuses a download whose hash
differs.

| Source | Pin |
|---|---|
| IBM Plex Sans 3.000 | `@ibm/plex-sans-variable@0.2.0`, commit `348dbb6121c34d755a6d2725c89b2abc9ffaa142`, archive `f83825d527be6cd39c8971c932b9bf22688a3ad3e5ac6305b6143d02f52b87b6` |
| Atkinson Hyperlegible Next 2.001 | `googlefonts/atkinson-hyperlegible-next` commit `7925f50f649b3813257faf2f4c0b381011f434f1`, variable TTF `5a455d1cfa099b601ab70751bb9673e8fe1854dc4500c80e1a220d0d75e31745` |
| Noto Sans Devanagari v2.007 | archive `820c7da45b1e63562cb41c0a8cac5d9a4202312043a3a040ed1325857ef469b1` |
| Noto Sans Tamil v2.004 | archive `f8284e0f200a7f29a439b4ec88280d864b2b31f8479111c5b658ba6da38b3005` |

## Speed (web)

| File | Bytes | Loaded |
|---|---|---|
| `MedBrainsSans-latin.woff2` (variable, 400-700, hinted) | 38,360 | every page; preloaded (web app, website) |
| `MedBrainsSans-extended.woff2` | 85,392 | only when a page draws Latin Extended, Greek, Cyrillic or Vietnamese |
| `NotoSansDevanagari.woff2` | 83,692 | only when a page draws Devanagari (web app) |
| `NotoSansTamil.woff2` | 26,816 | only when a page draws Tamil (web app) |

- **Latin** is ASCII, Latin-1 (µ ° ± × ÷ ² ³ ½) and ≤ ≥ → ₹ — and typographic punctuation.
- **One variable file holds weights 400 to 700.** Four static weights cut the same way would be
  about 91 KB; two already exceed the variable file.
- **Hinted.** IBM's TrueType hints are kept for the web files (steady baseline and spacing at
  14 px on 1x screens, about 5 KB). Smart dropout control is added ahead of them.
- **Self-hosted**, `font-display: swap`, WOFF2 only; no Google Fonts or CDN.
- **No layout shift.** `MedBrains Sans Fallback` is local Arial (Liberation Sans on Linux) with
  `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` computed by the build
  from the font's metrics. The web app, docs site, website and Kanidm all use it.
- First-load font bytes are 38.4 KB, under the 40 KB budget. The JS first-load budget
  (`scripts/check_size_budgets.py`) is unaffected.

## Indian scripts

MedBrains Sans draws Latin only. Noto Sans Devanagari and Noto Sans Tamil (OFL) are faces of the
same CSS family in the web app, so they need no extra stack entry. They pair at the same font size:
Noto's Devanagari headline sits at its Latin cap height (622 against 714 units), and Plex's cap
height is 698, 98% of Noto's. Other Indian scripts fall back to Noto where the device has it. On the
GTK shell the two Noto faces are installed beside the font and preferred by
`os/mkosi.extra/etc/fonts/conf.d/60-medbrains-sans.conf`; iOS and Android use the system's Indic
fonts.

## Native and GTK

One unhinted Latin TTF per weight: Light, Regular (cut at 440), Medium, SemiBold for iOS
(`MedBrainsSans-*.ttf`, registered by `CarbonType.register()`) and Android
(`res/font/medbrains_sans_*.ttf`, `MedBrainsSans` font family); Regular and SemiBold for the GTK
shell (`FONT` in `crates/medbrains-shell/src/prefs.rs`).

## Printed documents

Prescriptions, discharge summaries, bills, lab reports, labels and wristbands are rendered from
HTML to PDF by Chromium (rustenberg on the OS, Gotenberg in development). The shared base template
in `crates/medbrains-print/src/engine.rs` now prints in MedBrains Sans and `.mono` text (UHIDs,
codes) in IBM Plex Mono instead of Arial and Courier New:

- **Offline:** the fonts are inlined in the HTML as base64 data URIs (`include_bytes!`), so the
  renderer needs no network and no installed font. Every document, including
  `medbrains-documents-render`'s, goes through this template.
- **Static files, not the variable font:** Chromium writes a variable font into a PDF as Type 3
  glyphs; static TrueType embeds as subset CID TrueType, holding only the glyphs a page uses. The
  build makes Latin Regular (cut at 440), SemiBold and Bold into `crates/medbrains-print/fonts`.
  Plex Mono is IBM's own Latin-1 file, unmodified, so it keeps its name under the OFL.
- **Same layout:** the print faces take Arial's line box (`ascent-override` 90.5%,
  `descent-override` 21.2%, `line-gap-override` 3.3%), so pages, labels and wristbands keep the
  height they were laid out for. Sizes, letterheads, signatures, QR codes and DRAFT marks are
  unchanged. Glyphs are about 4% wider than Arial's, so a long line on a small label can wrap one
  word earlier.
- **A hospital's font wins:** when `branding.font_family` is set, it is used and the MedBrains Sans
  faces are not sent to the renderer.
- **Size:** each render sends about 220 KB more HTML to the local renderer. The PDFs themselves got
  smaller on the reference Mac (the subset is smaller than Arial's): prescription 111.9 → 35.1 KB,
  discharge summary 142.4 → 25.9 KB, pharmacy label 18.2 → 20.7 KB, wristband 25.4 → 28.4 KB.
- Before and after samples: `print-samples/` (`before-*.pdf`, `after-*.pdf`, `before-after.png`).

## Rebuild

```sh
cd medbrains
make fonts          # rebuild every file from the pinned sources, then the v0 review sheet
make check-fonts    # fail if a committed file differs from the build, or a kerned pair collides (CI)
```

Both use `uv` with `tools/fonts/requirements.txt` (fontTools, brotli, Pillow, uharfbuzz pinned) on
Python 3.12 and cache downloads in `~/.cache/medbrains-fonts`. `tools/fonts/render_easy_read.py`
draws the easy-read sheet. Never edit a font file or a generated `medbrains-sans.css`/`fonts.css`
by hand.

## History: round 2 comparison (2026-11-10)

The owner asked for a font that is more professional, modern, clean, easily readable and supports
people with disabilities. Two review sheets compare the options; the shipped font stays the Plex
build until the owner picks.

- [`medbrains-sans-round2-candidates.png`](medbrains-sans-round2-candidates.png) (`.pdf`): MedBrains
  Sans built from four bases with the same clinical defaults, plus an "Easy reading" column (proposed, not adopted),
  side by side, light and dark: clinical lines at 12/14/16/24 px, mirror and confusable letters
  (b d p q, rn/m, cl/d, Il1, O0, 5S, 2Z, 6b, 8B), a low-vision row (1.5 px blur, just-AA grey on
  white and on dark), a patient instruction at 16 px with line height 1.5, apparent size at the same
  56 px with x-height rules, and the four weights.
- [`medbrains-sans-round2-accessible.png`](medbrains-sans-round2-accessible.png) (`.pdf`):
  "MedBrains Sans Accessible", our own font changed in code, one change per column beside v0.

Rebuild both: `uv run --no-project --python 3.12 --with-requirements tools/fonts/requirements.txt
python -I tools/fonts/render_round2.py` (about 2.5 minutes). Any base builds the real files with
`build_medbrains_sans.py --base plex|atkinson|inter|lexend`; the default and `make check-fonts`
stay on Plex.

### Bases

All four are under the SIL OFL 1.1, pinned by commit and SHA-256 in `tools/fonts/bases.py`.

| Base | Source | Reserved Font Name | Clinical defaults frozen | Gaps | Latin WOFF2 (400-700) |
|---|---|---|---|---|---|
| IBM Plex Sans 3.000 | `@ibm/plex-sans-variable@0.2.0`, `348dbb6` | "Plex" | slashed zero (outline copy); figures already tabular; I l 1 already distinct | none | 36.8 KB, hinted |
| Atkinson Hyperlegible Next 2.001 | `googlefonts/atkinson-hyperlegible-next`, `7925f50` | none | `tnum`; zero, I, l, 1 are already distinct by design | unhinted | 19.3 KB |
| Inter 4.1 | `rsms/inter` v4.1, `e3a3d4c` | none ("Inter" is a trademark of rsms; we do not use the name) | `tnum`, `ss02` (slashed zero, serifed I, tailed l) | unhinted; over budget | 44.5 KB (39.3 KB if the circled/squared sets are dropped) |
| Lexend 1.008 | `googlefonts/lexend`, `7894f02` | "RevReading Lexend" | `zero`, `ss01` (serifed I) | no tabular figures (no `tnum`), plain l, widest | 21.0 KB |

Metrics at the same font size: x-height Inter 0.546 em, Lexend 0.525, Plex 0.516, Atkinson 0.496;
average width Lexend 0.479 em, Inter 0.472, Plex 0.446, Atkinson 0.441.

### MedBrains Sans Accessible: changes to our own font

| Change | Latin WOFF2 cost | Ships in | Notes |
|---|---|---|---|
| 1 Spacing +20 units (2% em) | +80 B | variable WOFF2, all weights | side bearings, half each side; lines 4.5% longer. +12 units in the mix |
| 2 Regular at wght 440 | 0 | variable WOFF2 (CSS `font-weight: 440` for body); statics re-cut | free with a variable font |
| 3 Tail on q | +84 B | variable WOFF2, all weights | Plex b and d already carry a baseline spur, so q is the one mirror left; the tail's points follow the stem's weight deltas |
| 4 Open apertures (c e s a) | static Regular TTF +24 B | static TTFs only | a boolean cut changes point counts and breaks interpolation; doing it in the variable font needs the UFO masters and a designer's eye |
| 5 Dotted zero | +108 B | variable WOFF2 | Plex's `ss04`; shown beside the slashed zero |
| 6 Atkinson b d p q l 1 | +252 B | variable WOFF2 | Atkinson cut to the same 300-700 axis, outlines and weight deltas copied, scaled to Plex's x-height (1 to cap height, centred in the tabular width). Advance variations stay Plex's for those glyphs, so bold spacing needs checking |

Mixing glyphs from two OFL fonts is allowed: the result is a Modified Version of both, released
under the OFL. It must not use either Reserved Font Name ("Plex"; Atkinson Next has none), and
it must carry both copyright notices: name ID 0 and `OFL.txt` would list IBM's line, the Atkinson
Hyperlegible Next Project Authors' line and ours, and name ID 9 both design teams.

The owner first approved the Plex mix with a tail on q, then asked for the easy-read traits in the
font itself: the shipped mix above takes Atkinson's b d p q l 1 instead of the tail, and there is
no separate "Easy reading" family.
