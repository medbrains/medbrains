# MedBrains Sans

MedBrains Sans is the interface font of every MedBrains surface: web, iOS, Android and the GTK
desktop shell. It is IBM Plex Sans with its clinical alternate made the default, built by code from
a pinned Plex release. IBM Plex Mono and Archivo stay as they are.

Review sheet: [`medbrains-sans-v0-samples.png`](medbrains-sans-v0-samples.png) (and
[`.pdf`](medbrains-sans-v0-samples.pdf), one page per weight): doses, IDs, lab values, the
classic confusables, look-alike drug names and a Devanagari line, Plex and MedBrains Sans side
by side, light and dark, at 12, 14, 16 and 24 px.

## Licence

IBM Plex is under the SIL Open Font License 1.1 with the Reserved Font Name "Plex". A modified
version may ship under another name, so:

- the font is named MedBrains Sans (PostScript `MedBrainsSans-*`); no name record says Plex, except
  the designers, the version (the source it came from) and the description (its lineage). The build
  fails if any other record does;
- the copyright record keeps IBM's line and adds ours;
- `OFL.txt` (our line, then IBM's licence text) sits next to every copy: the web assets, the iOS
  `Fonts` folder, `apps/android/ui/src/main/assets/licenses` (Android's `res/font` takes only fonts)
  and the GTK shell's `fonts`. The Noto faces carry `OFL-Noto.txt`.

## Source

| | |
|---|---|
| Plex release | `@ibm/plex-sans-variable@0.2.0`, IBM Plex Sans 3.000, upright variable TTF |
| Plex commit | `348dbb6121c34d755a6d2725c89b2abc9ffaa142` |
| Archive SHA-256 | `f83825d527be6cd39c8971c932b9bf22688a3ad3e5ac6305b6143d02f52b87b6` |
| Noto Sans Devanagari | v2.007, slim variable, archive SHA-256 `820c7da45b1e63562cb41c0a8cac5d9a4202312043a3a040ed1325857ef469b1` |
| Noto Sans Tamil | v2.004, slim variable, archive SHA-256 `f8284e0f200a7f29a439b4ec88280d864b2b31f8479111c5b658ba6da38b3005` |

The pins live in `medbrains/tools/fonts/build_medbrains_sans.py`; the build refuses an archive
whose hash differs.

## What changed from Plex

Plex's GSUB was inspected for every stylistic set:

| Set | What it changes | Used |
|---|---|---|
| `ss01` | single-storey a | no: the two-storey a is further from o and d |
| `ss02` | single-storey g | no |
| `ss03` / `zero` | slashed zero | **yes, frozen as the default `0`** |
| `ss04` | dotted zero | no (still available as `ss04`) |
| `ss05` | alternate ß | no |
| `ss06` | Bulgarian Cyrillic | no |

- **Slashed zero by default.** The outline (and its weight variations) of `zero.alt02` replaces
  `zero`, and `zero.tosf.alt02` replaces `zero.tosf`, so `0` and `O` differ in every app, including
  ones that cannot turn features on. Advance widths are unchanged.
- **Tabular figures are already Plex's default**: every digit is 600 units wide in every weight.
  Plex has no `tnum`/`pnum` feature because nothing needs switching. The build fails if a digit's
  width ever differs.
- **No outline was redrawn.** Plex already gives capital I serifs, lowercase l a tail, and 1 a flag
  and a foot; its 4 is closed. The sheet shows 5/S, 2Z, 8/B and 6/b clearly distinct at 12 px in
  every weight, so they were left alone. A type designer's review is optional later.

## Speed (web)

| File | Bytes | Loaded |
|---|---|---|
| `MedBrainsSans-latin.woff2` | 37,692 | every page; preloaded by `apps/web/index.html` |
| `MedBrainsSans-extended.woff2` | 85,488 | only when a page draws Latin Extended, Greek, Cyrillic or Vietnamese |
| `NotoSansDevanagari.woff2` | 80,896 | only when a page draws Devanagari |
| `NotoSansTamil.woff2` | 26,504 | only when a page draws Tamil |

- **Latin** is ASCII, Latin-1 (µ ° ± × ÷ ² ³ ½) and ≤ ≥ → ₹ — and typographic punctuation.
- **One variable file holds weights 400 to 700.** Measured against static files cut the same way:
  one static weight is 22,804 bytes hinted (17,424 unhinted), so four are about 91 KB; the variable
  file is 37,692 hinted (about 32,000 unhinted). Every screen uses at least body (400) and
  headings or buttons (600/700), and two static weights already exceed the variable file.
- **Hinted.** IBM's TrueType hinting is kept for the web files: at 14 px on a 1x screen the hinted
  file keeps a steady baseline and even spacing, where unhinted text spaces unevenly. It costs about
  5 KB (17%). Smart dropout control is added ahead of IBM's hints.
- **Self-hosted**, `font-display: swap`, WOFF2 only. No Google Fonts or CDN.
- **No layout shift.** `MedBrains Sans Fallback` is local Arial (Liberation Sans on Linux) with
  `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` computed by the
  build from MedBrains Sans' metrics. With the font delayed 1.5 s, the sign-in page recorded no
  layout shift when it arrived.
- First-load font bytes are 37.7 KB (WOFF2 is already compressed; gzip leaves it at 37.5 KB),
  under the 40 KB budget. The JS first-load budget (`scripts/check_size_budgets.py`) is unaffected.

## Indian scripts

MedBrains Sans draws Latin only. Noto Sans Devanagari and Noto Sans Tamil (OFL) are faces of the
same CSS family, so they need no extra stack entry. They pair at the same font size: Noto's
Devanagari headline sits at its Latin cap height (622 against 714 units), and Plex's cap height is
698, 98% of Noto's, which is too close to need a size adjustment. Other Indian scripts fall back to
Noto where the device has it (listed in the token stack). On the GTK shell the two Noto faces are
installed beside the font and preferred by `os/mkosi.extra/etc/fonts/conf.d/60-medbrains-sans.conf`;
iOS and Android use the system's Indic fonts.

## Native and GTK

One unhinted Latin TTF per weight: Light, Regular, Medium, SemiBold for iOS
(`MedBrainsSans-*.ttf`, registered by `CarbonType.register()`) and Android
(`res/font/medbrains_sans_*.ttf`, `MedBrainsSans` font family); Regular and SemiBold for the GTK
shell (`FONT` in `crates/medbrains-shell/src/prefs.rs`).

## Rebuild

```sh
cd medbrains
make fonts          # rebuild every file from the pinned sources, then the review sheet
make check-fonts    # fail if a committed file differs from the build (CI runs this)
```

Both use `uv` with `tools/fonts/requirements.txt` (fontTools, brotli and Pillow pinned) on Python
3.12, and cache the downloads in `~/.cache/medbrains-fonts`. Never edit a font file or
`packages/design-system/src/styles/fonts.css` by hand.

## Round 2: candidate bases and accessibility changes (proposed, nothing shipped)

The owner asked for a font that is more professional, modern, clean, easily readable and supports
people with disabilities. Two review sheets compare the options; the shipped font stays the Plex
build until the owner picks.

- [`medbrains-sans-round2-candidates.png`](medbrains-sans-round2-candidates.png) (`.pdf`): MedBrains
  Sans built from four bases with the same clinical defaults, plus the proposed Easy reading setting,
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

### Recommendation

- **Default: keep the Plex base and adopt the mix**: spacing +12 units, Regular at 440, tail on q,
  slashed zero kept. It stays professional and recognisably ours. It is the only candidate with
  TrueType hinting, which keeps 14 px text steady on cheap low-DPI screens. The Indic pairing is
  already matched, and the mix is 80 B smaller than v0 (37,612 B), within compression noise.
- **Easy reading: Atkinson Hyperlegible Next**, built as a second family and loaded only when a
  person turns the setting on. It was designed for low vision: every confusable letter differs,
  and it is the smallest file (19.3 KB). Its look is distinctive rather than neutral, and its small
  x-height means it needs the larger size the setting gives it anyway.
- **Inter** is the cleanest neutral alternative if the owner prefers a modern generic look to IBM's
  character. It has the largest apparent size, but it is unhinted and over the 40 KB budget unless
  its decorative sets are dropped.
- **Lexend: no.** It has no tabular figures, so dose and lab columns would not align. It is also the
  widest, which pushes tables wider.
- Open apertures and the Atkinson hybrid are worth a designer's review, not shipping from code.

### Proposal: a per-person "Easy reading" setting (not built)

One switch, saved on the person's profile so it follows them to every device:

| Surface | What it takes |
|---|---|
| Font build | Build a second family, "MedBrains Easy", from the Atkinson base in the same run: `MedBrainsEasy-latin.woff2` (about 19 KB) and `fonts-easy.css`, plus TTFs for native and GTK. `check-fonts` covers it. `fonts.css` never references it, so the default first load stays at 36.8 KB |
| Web | A profile preference (and `localStorage` for the sign-in screen). `<html data-reading="easy">` loads `fonts-easy.css` with a dynamic import. The theme's easy variant sets the family, base size 14 → 16 px (18 px for patient screens), letter-spacing 0.04 em and line-height 1.7, and forces italic and condensed styles to normal. Sizes stay in rem, so browser and OS text size still scale |
| iOS | A settings toggle. `CarbonType` switches to the MedBrains Easy faces, one Dynamic Type step larger, with `.tracking` and line spacing. It keeps `relativeTo:`, so the system text size still applies, and respects Bold Text. Adds about 150 KB to the app |
| Android | A `MedBrainsEasy` FontFamily and a scaled copy of the Typography (sizes in sp, so the system font scale still applies), with letter spacing and line height. The setting lives in DataStore |
| GTK shell | `reading=easy` in `/var/lib/kiosk/shell-prefs`; `FONT` becomes "MedBrains Easy 13"; CSS letter-spacing; honours the desktop text-scaling factor; a toggle next to theme and motion |
