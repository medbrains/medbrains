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
