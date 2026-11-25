---
date: 2026-11-25
title: A statutory register prints every entry of its period, bounded by the period
status: decided
area: print
---

## What

The MLC register, the birth and death registers and the biomedical-waste (SPCB) return print
every entry of the period asked for. The `LIMIT 5000` on their entry queries is gone; the bound
is the period itself, at most a year (`period_bounds`).

## Why

Each stopped at 5,000 rows without a word. A busy emergency department passes 5,000 medico-legal
cases a year and a large maternity unit passes 5,000 births, so the printed register — a legal
record — was silently incomplete, and the MLC totals, counted from the printed rows, were wrong.

## Rejected

- Paginating with "Rows X–Y of Z; continued" on each print: the print templates take one
  document per period, and a year of one hospital's register (tens of thousands of rows at
  most) fits one response. Worth revisiting if a single year ever outgrows that.
- Refusing a period over a row count and asking for a shorter one: it puts a limit on a legal
  record that no regulator sets.
