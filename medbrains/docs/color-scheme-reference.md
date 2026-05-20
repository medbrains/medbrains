# MedBrains Color Scheme Reference

This is a reference shortlist for senior review. It is not wired as a runtime theme switcher.

## Selection Rule

Use one primary institutional palette for the product shell, then keep clinical status colors stable across every palette.

- Normal / success: green
- Warning / pending: amber
- Critical / danger: red
- Information: blue
- Emergency code colors: not themeable

## Option 1: Clinical Teal + Copper

Recommended default for HMS operations.

| Token | Color |
| --- | --- |
| Primary | `#0F766E` |
| Primary hover | `#115E59` |
| Secondary | `#0EA5E9` |
| Accent | `#B8924A` |
| Canvas | `#F4FBF9` |
| Surface | `#FFFFFF` |
| Text | `#0F1412` |
| Muted text | `#64748B` |
| Border | `#DCEBE8` |

Why it works: clinical, calm, and premium without looking like a consumer app. Copper gives finance, admin, and executive screens a warmer senior-management feel.

Best for: default web app, OPD, IPD, nursing, dashboards, camp workflows.

## Option 2: Hospital Navy + Mint

Conservative institutional look for senior administration.

| Token | Color |
| --- | --- |
| Primary | `#164E63` |
| Primary hover | `#0E3A4A` |
| Secondary | `#0F766E` |
| Accent | `#D97706` |
| Canvas | `#F6FAFB` |
| Surface | `#FFFFFF` |
| Text | `#111827` |
| Muted text | `#64748B` |
| Border | `#D8E3E8` |

Why it works: serious and boardroom-friendly. Mint keeps the hospital association while navy adds authority.

Best for: executive command center, reports, NABH, finance, audit, board presentations.

## Option 3: Clean Blue + Green

Straightforward healthcare software style.

| Token | Color |
| --- | --- |
| Primary | `#2563EB` |
| Primary hover | `#1D4ED8` |
| Secondary | `#059669` |
| Accent | `#F59E0B` |
| Canvas | `#F8FAFC` |
| Surface | `#FFFFFF` |
| Text | `#0F172A` |
| Muted text | `#64748B` |
| Border | `#E2E8F0` |

Why it works: familiar, clear, and easy to approve. It feels closest to modern enterprise SaaS while still fitting clinical workflows.

Best for: first hospital rollout, mobile app, staff-facing operational screens.

## Option 4: Surgical Graphite + Aqua

High-contrast professional scheme for dense data screens.

| Token | Color |
| --- | --- |
| Primary | `#155E75` |
| Primary hover | `#164E63` |
| Secondary | `#14B8A6` |
| Accent | `#7C3AED` |
| Canvas | `#F3F7F8` |
| Surface | `#FFFFFF` |
| Text | `#111827` |
| Muted text | `#6B7280` |
| Border | `#DCE4E7` |

Why it works: restrained and technical. Aqua keeps it clinical, while the violet accent can be reserved for AI and intelligence features.

Best for: analytics, lab, radiology, data quality, AI-assisted workflows.

## Option 5: Public Health Green + Blue

Community-health oriented scheme for outreach and camps.

| Token | Color |
| --- | --- |
| Primary | `#047857` |
| Primary hover | `#065F46` |
| Secondary | `#0284C7` |
| Accent | `#CA8A04` |
| Canvas | `#F7FBF7` |
| Surface | `#FFFFFF` |
| Text | `#10201A` |
| Muted text | `#66756F` |
| Border | `#DCE9E1` |

Why it works: approachable for community hospitals, camps, rural outreach, and public-health reporting without becoming decorative.

Best for: camp management, public health, outreach, patient engagement, community dashboards.

## Recommendation

Use Option 1 as the product default.

Keep Option 2 as the executive/demo variant for board-level presentations. Use Option 5 for camp and public-health collateral if a separate visual identity is needed later.

Avoid changing these per module inside the same logged-in product. Too many schemes in daily use will make the HMS feel inconsistent and harder to train.
