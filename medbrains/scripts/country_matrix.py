#!/usr/bin/env python3
"""Render docs/compliance/country-matrix.md from country-matrix.json, the source of truth.

    python3 scripts/country_matrix.py           # write the Markdown table
    python3 scripts/country_matrix.py --check   # fail if the Markdown is stale
"""

import json
import sys
from collections import Counter
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs/compliance"
SOURCE, OUT = DOCS / "country-matrix.json", DOCS / "country-matrix.md"
TIERS = {"A": "software certification or approval confirmed",
         "B": "integration mandated or a national system exists; no product certification confirmed",
         "C": "no national digital-health mandate found"}


def cell(value) -> str:
    """One table cell from a row field: nested dicts show their name, lists join, pipes escaped."""
    if isinstance(value, dict):
        value = value.get("name") or ""
    if isinstance(value, list):
        value = ", ".join(map(str, value))
    return str(value or "").replace("|", "/").replace("\n", " ")


def render(rows: list) -> str:
    """The Markdown page: legend, tier counts, then one line per country sorted by tier then name."""
    tiers, conf = Counter(r["tier"] for r in rows), Counter(r.get("confidence") for r in rows)
    out = ["# Country matrix", "",
           f"Generated from `country-matrix.json` by `scripts/country_matrix.py`; edit the JSON, not this page. "
           f"{len(rows)} countries and territories, researched 2026-11-15. Rows marked low confidence are a first "
           "screen from search results; a country's row is checked against official documents before it gets an epic.", ""]
    out += [f"- **Tier {t}** ({tiers[t]}): {d}" for t, d in TIERS.items()]
    out += ["", f"Confidence: {conf['high']} high, {conf['medium']} medium, {conf['low']} low.", "",
            "| Tier | Country | Health exchange | Vendor certification | Claims | Data protection | Localisation | Confidence | Epic | Notes |",
            "|---|---|---|---|---|---|---|---|---|---|"]
    for r in sorted(rows, key=lambda r: (r["tier"], r["country"])):
        epic = f"#{r['epic']}" if r.get("epic") else ""
        out.append("| " + " | ".join([r["tier"], r["country"], cell(r.get("hie")), cell(r.get("vendor_certification")),
                                      cell(r.get("claims")), cell(r.get("data_protection")), cell(r.get("localisation")),
                                      cell(r.get("confidence")), epic, cell(r.get("notes"))]) + " |")
    return "\n".join(out) + "\n"


def self_check() -> None:
    """A dict cell shows its name and a pipe can never break the table."""
    assert cell({"name": "A|B"}) == "A/B" and cell(["x", "y"]) == "x, y" and cell(None) == ""


if __name__ == "__main__":
    self_check()
    text = render(json.loads(SOURCE.read_text()))
    if "--check" in sys.argv:
        sys.exit(0 if OUT.exists() and OUT.read_text() == text else "country-matrix.md is stale: run scripts/country_matrix.py")
    OUT.write_text(text)
