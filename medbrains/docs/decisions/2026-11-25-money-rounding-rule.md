---
date: 2026-11-25
title: Money is rounded to the paisa half away from zero, in one helper
status: decided
area: billing
---

## What

Every money amount in Rust is rounded with `.to_paisa()` from
`medbrains_core::money::RoundMoney`: two decimals, half away from zero (2.345 → 2.35,
−2.345 → −2.35). `scripts/check_money_rounding.py` (CI and `make check-money-rounding`)
fails any other `round_dp(` / `round_dp_with_strategy(` unless the line says
`// rounding: <reason>` (percentages, ratios, vital signs, deliberate caps such as the
storefront's round-down that keeps a bill under MRP).

## Why

Billing used `round_dp(2)`, which in `rust_decimal` is banker's rounding (half to even), at
about 80 sites, while the payer split, the storefront, the doctor-payout engine, PostgreSQL's
`round()` and numeric casts round half away from zero. One bill could disagree with its own
receipt, its credit note or its report by a paisa.

What the law says, as far as found:

- CGST Act 2017 s.170 rounds tax, interest, penalty, fine and refunds *payable* to the nearest
  rupee, fifty paise or more going up. That is half away from zero, at the rupee, on the amount
  payable. Secondary commentary (ClearTax, Masters India) reads it as applying per invoice and
  per tax head (CGST, SGST, IGST separately).
- Neither the Act nor the CGST Rules (Rule 46, tax invoice contents) prescribe how a line's
  paise are rounded. The GST e-invoice schema carries two decimals.

So the line-level rule is a commercial convention, not a statutory one. Half away from zero
matches s.170's direction and what PostgreSQL already does.

**For the owner and the hospital's accountant:** confirm the line-level rule, and whether an
invoice should also round its payable total to the rupee per s.170 (not done here).

Sources: https://cleartax.in/s/rounding-off-tax-section-170-gst,
https://www.mastersindia.co/blog/rounding-off-tax-under-gst/,
https://taxinformation.cbic.gov.in/content/html/tax_repository/gst/acts/2017_CGST_act/documents/Central_Goods_and_Services_Tax_Act__2017_28-September-2022.html

## Rejected

- Keep banker's rounding everywhere: it disagrees with PostgreSQL and every other money path
  already written half away from zero, and nothing in GST practice asks for it.
- A per-tenant rounding setting: no hospital has asked, and two rules would bring back the
  disagreement this removes.
- A baseline of existing sites: every site was converted, so the check needs no baseline.
