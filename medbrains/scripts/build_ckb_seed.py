#!/usr/bin/env python3
"""Build the Clinical Knowledge Base diagnosis-reference seed CSV.

Source of de-identified clinical knowledge (NOT committed, operator-local):
  <sir>/analysis/non_notifiable_diseases.xlsx  — 225 common OPD diagnoses
      (columns: Dept, Diagnosis, ICD-10, Notifiable, demographics...).
      We take ONLY Dept / Diagnosis / ICD-10 (no patient data).

Plus a curated national IDSP/IHIP notifiable-disease list (public-health
knowledge, embedded below) that drives the statutory reporting alerts.

Output (committed = github-tracked source + backup):
  crates/medbrains-server/src/seed/data/diagnosis_reference.csv
  columns: icd10_code,name,department,is_notifiable,reporting_body,report_timeframe

Usage:
  python3 scripts/build_ckb_seed.py [--src /path/to/sir]
Re-run whenever the source knowledge changes; commit the resulting CSV.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys

# National notifiable diseases (IDSP / IHIP, Epidemic Diseases Act 1897; the
# standard P/L/S surveillance list). Public-health reference knowledge — not
# patient data. (icd10, name, department, reporting_body, timeframe)
IDSP_NOTIFIABLE: list[tuple[str, str, str, str, str]] = [
    ("A00", "Cholera", "Medicine", "IDSP", "24h"),
    ("A01.0", "Typhoid fever", "Medicine", "IDSP", "weekly"),
    ("A03", "Shigellosis (bacillary dysentery)", "Medicine", "IDSP", "weekly"),
    ("A05", "Acute diarrhoeal disease / food poisoning", "Medicine", "IDSP", "24h"),
    ("A15", "Tuberculosis (pulmonary)", "Medicine", "Ni-kshay/RNTCP", "24h"),
    ("A19", "Miliary tuberculosis", "Medicine", "Ni-kshay/RNTCP", "24h"),
    ("A20", "Plague", "Medicine", "IDSP", "24h"),
    ("A22", "Anthrax", "Medicine", "IDSP", "24h"),
    ("A27", "Leptospirosis", "Medicine", "IDSP", "24h"),
    ("A30", "Leprosy", "Skin", "NLEP", "weekly"),
    ("A33", "Tetanus neonatorum", "Paediatrics", "IDSP", "24h"),
    ("A35", "Tetanus", "Medicine", "IDSP", "24h"),
    ("A36", "Diphtheria", "Paediatrics", "IDSP", "24h"),
    ("A37", "Whooping cough (pertussis)", "Paediatrics", "IDSP", "24h"),
    ("A39", "Meningococcal disease", "Medicine", "IDSP", "24h"),
    ("A80", "Acute flaccid paralysis / poliomyelitis", "Paediatrics", "IDSP", "24h"),
    ("A82", "Rabies", "Medicine", "IDSP", "24h"),
    ("A83.0", "Japanese encephalitis", "Medicine", "IDSP", "24h"),
    ("A90", "Dengue fever", "Medicine", "IDSP", "24h"),
    ("A91", "Dengue haemorrhagic fever", "Medicine", "IDSP", "24h"),
    ("A92.0", "Chikungunya", "Medicine", "IDSP", "weekly"),
    ("A95", "Yellow fever", "Medicine", "IDSP", "24h"),
    ("B05", "Measles", "Paediatrics", "IDSP", "24h"),
    ("B06", "Rubella", "Paediatrics", "IDSP", "weekly"),
    ("B15", "Acute hepatitis A", "Medicine", "IDSP", "weekly"),
    ("B16", "Acute hepatitis B", "Medicine", "IDSP", "weekly"),
    ("B17.1", "Acute hepatitis C", "Medicine", "IDSP", "weekly"),
    ("B19", "Acute viral hepatitis, unspecified", "Medicine", "IDSP", "weekly"),
    ("B50", "Plasmodium falciparum malaria", "Medicine", "IDSP/NVBDCP", "24h"),
    ("B51", "Plasmodium vivax malaria", "Medicine", "IDSP/NVBDCP", "24h"),
    ("B54", "Malaria, unspecified", "Medicine", "IDSP/NVBDCP", "24h"),
    ("B74", "Filariasis", "Medicine", "NVBDCP", "weekly"),
    ("J09", "Influenza due to novel virus (incl. H1N1)", "Medicine", "IDSP", "24h"),
    ("J10", "Influenza, seasonal", "Medicine", "IDSP", "weekly"),
    ("U07.1", "COVID-19", "Medicine", "IDSP/IHIP", "24h"),
    ("W54.0", "Animal bite (rabies risk)", "Casualty", "IDSP", "24h"),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--src",
        default=os.path.expanduser("~/Projects/sir"),
        help="Path to the local de-identified knowledge folder (sir).",
    )
    args = parser.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(repo, "crates", "medbrains-server", "src", "seed", "data")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "diagnosis_reference.csv")

    rows: list[tuple[str, str, str, str, str, str]] = []
    seen: set[str] = set()

    # 1) Curated notifiable list first (so it wins on icd10 collisions).
    for icd, name, dept, body, tf in IDSP_NOTIFIABLE:
        key = icd.strip().upper()
        if key in seen:
            continue
        seen.add(key)
        rows.append((key, name, dept, "true", body, tf))

    # 2) Real de-identified OPD diagnoses (non-notifiable) from the xlsx.
    xlsx = os.path.join(args.src, "analysis", "non_notifiable_diseases.xlsx")
    if os.path.exists(xlsx):
        import openpyxl  # local dependency, operator machine only

        wb = openpyxl.load_workbook(xlsx, read_only=True)
        ws = wb.active
        data = list(ws.iter_rows(values_only=True))
        hdr = [str(c).strip() for c in data[0]]
        di, ni, ii = hdr.index("Dept"), hdr.index("Diagnosis"), hdr.index("ICD-10")
        for r in data[1:]:
            icd = str(r[ii] or "").strip().upper()
            name = str(r[ni] or "").strip()
            dept = str(r[di] or "").strip()
            if not icd or not name or icd in seen:
                continue
            seen.add(icd)
            rows.append((icd, name, dept, "false", "", ""))
    else:
        print(f"WARN: {xlsx} not found — emitting notifiable list only.", file=sys.stderr)

    rows.sort(key=lambda x: x[0])
    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["icd10_code", "name", "department", "is_notifiable", "reporting_body", "report_timeframe"])
        w.writerows(rows)

    notifiable = sum(1 for r in rows if r[3] == "true")
    print(f"Wrote {len(rows)} rows ({notifiable} notifiable) → {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
