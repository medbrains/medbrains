# MedBrains Color Scheme Reference

This is a reference shortlist for senior review. It is not wired as a runtime theme switcher.

## How to Demo

Change these exports in `apps/web/src/theme.ts`, then reload the app.

```ts
export const ACTIVE_COLOR_SCHEME = "clinical_teal_copper";
export const ACTIVE_FONT_SCHEME = "manrope_nunito";
```

Available color scheme ids:

- `clinical_teal_copper`
- `hospital_navy_mint`
- `clean_blue_green`
- `surgical_graphite_aqua`
- `public_health_green_blue`

Available font scheme ids:

- `manrope_nunito` — warmer demo option
- `nunito_manrope` — softer and friendlier
- `system_premium` — uses system Avenir Next if available, then Manrope/Nunito Sans
- `previous_ibm_plex` — active default: IBM Plex Sans, Noto Sans, system fallback

## Selection Rule

Use one primary institutional palette for the product shell, then keep clinical status colors stable across every palette.

- Normal / success: green
- Warning / pending: amber
- Critical / danger: red
- Information: blue
- Emergency code colors: not themeable

## Option 1: Executive Charcoal + Teal

Recommended default for HMS operations.

| Token | Color |
| --- | --- |
| Primary | `#0B5D6B` |
| Primary hover | `#084C5A` |
| Secondary | `#188A75` |
| Accent | `#A6722A` |
| Canvas | `#F6F9F9` |
| Surface | `#FFFFFF` |
| Text | `#111A1C` |
| Muted text | `#66777A` |
| Border | `#D7E3E2` |

Why it works: quieter and more institutional than the first pastel set. The sidebar is neutral with a controlled teal active state and a brass accent.

Best for: default web app, OPD, IPD, nursing, dashboards, camp workflows.

## Option 2: Navy Steel + Brass

Conservative institutional look for senior administration.

| Token | Color |
| --- | --- |
| Primary | `#1F4E79` |
| Primary hover | `#173E61` |
| Secondary | `#2F7A6D` |
| Accent | `#B7791F` |
| Canvas | `#F6F9FB` |
| Surface | `#FFFFFF` |
| Text | `#101820` |
| Muted text | `#647484` |
| Border | `#D8E3EA` |

Why it works: strong senior-management look without a dark UI. Better for demos where the hospital leadership wants a formal enterprise feel.

Best for: executive command center, reports, NABH, finance, audit, board presentations.

## Option 3: Boardroom Blue + Emerald

Straightforward healthcare software style.

| Token | Color |
| --- | --- |
| Primary | `#315C9B` |
| Primary hover | `#284B80` |
| Secondary | `#2F855A` |
| Accent | `#8A6F2A` |
| Canvas | `#F7F9FC` |
| Surface | `#FFFFFF` |
| Text | `#0F172A` |
| Muted text | `#64748B` |
| Border | `#D9E2EE` |

Why it works: familiar enterprise blue, but muted enough for hospital operations. Emerald provides healthcare association without making the whole app green.

Best for: first hospital rollout, mobile app, staff-facing operational screens.

## Option 4: Graphite + Indigo

High-contrast professional scheme for dense data screens.

| Token | Color |
| --- | --- |
| Primary | `#2F4858` |
| Primary hover | `#263A47` |
| Secondary | `#3A7D7E` |
| Accent | `#5B5F97` |
| Canvas | `#F6F7F9` |
| Surface | `#FFFFFF` |
| Text | `#12171B` |
| Muted text | `#6B7280` |
| Border | `#DBE2E7` |

Why it works: the most restrained option. Good when the product should look technical, serious, and dense-data friendly.

Best for: analytics, lab, radiology, data quality, AI-assisted workflows.

## Option 5: Public Health Deep Green

Community-health oriented scheme for outreach and camps.

| Token | Color |
| --- | --- |
| Primary | `#2E6F54` |
| Primary hover | `#245A43` |
| Secondary | `#2C6E7F` |
| Accent | `#9A7A25` |
| Canvas | `#F7FAF8` |
| Surface | `#FFFFFF` |
| Text | `#10201A` |
| Muted text | `#66756F` |
| Border | `#D9E7DD` |

Why it works: calmer and more mature than bright public-health green. It supports camps and outreach without looking like a separate app.

Best for: camp management, public health, outreach, patient engagement, community dashboards.

## Recommendation

Use Option 1 as the product default.

Keep Option 2 as the executive/demo variant for board-level presentations. Use Option 5 for camp and public-health collateral if a separate visual identity is needed later.

Avoid changing these per module inside the same logged-in product. Too many schemes in daily use will make the HMS feel inconsistent and harder to train.
