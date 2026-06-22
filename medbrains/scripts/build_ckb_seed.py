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


# Curated public CDS dosing reference for common drugs — standard adult values
# from the WHO EML / NLEM 2022 / BNF (public reference knowledge, not patient
# data). (generic, max_dose_per_day, max_single_dose, renal_egfr_threshold,
# renal_rule, hepatic_caution, pregnancy_category)
CURATED_CDS: list[tuple[str, str, str, str, str, str, str]] = [
    ("paracetamol", "4000 mg", "1000 mg", "", "", "Reduce dose in chronic liver disease", "B"),
    ("ibuprofen", "2400 mg", "800 mg", "30", "Avoid if eGFR < 30", "", "C"),
    ("diclofenac", "150 mg", "50 mg", "30", "Avoid if eGFR < 30", "", "C"),
    ("aceclofenac", "200 mg", "100 mg", "30", "Avoid if eGFR < 30", "", "C"),
    ("naproxen", "1000 mg", "500 mg", "30", "Avoid if eGFR < 30", "", "C"),
    ("aspirin", "4000 mg", "1000 mg", "", "", "", "C"),
    ("amoxicillin", "3000 mg", "1000 mg", "30", "Reduce frequency if eGFR < 30", "", "B"),
    ("amoxicillin_clav", "3000 mg", "1000 mg", "30", "Reduce frequency if eGFR < 30", "", "B"),
    ("azithromycin", "500 mg", "500 mg", "", "", "Caution in hepatic impairment", "B"),
    ("ciprofloxacin", "1500 mg", "750 mg", "30", "Halve dose if eGFR < 30", "", "C"),
    ("levofloxacin", "750 mg", "750 mg", "50", "Reduce dose if eGFR < 50", "", "C"),
    ("metronidazole", "2000 mg", "800 mg", "", "", "Reduce dose in severe hepatic impairment", "B"),
    ("ceftriaxone", "4000 mg", "2000 mg", "", "", "", "B"),
    ("cefixime", "400 mg", "200 mg", "20", "Reduce dose if eGFR < 20", "", "B"),
    ("metformin", "2550 mg", "1000 mg", "30", "Stop if eGFR < 30 (lactic acidosis)", "", "C"),
    ("glimepiride", "8 mg", "8 mg", "", "", "Caution in hepatic impairment", "C"),
    ("amlodipine", "10 mg", "10 mg", "", "", "", "C"),
    ("telmisartan", "80 mg", "80 mg", "", "", "Caution in biliary obstruction", "D"),
    ("losartan", "100 mg", "100 mg", "", "", "Reduce dose in hepatic impairment", "D"),
    ("atenolol", "100 mg", "100 mg", "35", "Reduce dose if eGFR < 35", "", "D"),
    ("atorvastatin", "80 mg", "80 mg", "", "", "Contraindicated in active liver disease", "X"),
    ("prednisolone", "60 mg", "60 mg", "", "", "", "C"),
    ("pantoprazole", "80 mg", "40 mg", "", "", "Max 20 mg/day in severe hepatic impairment", "B"),
    ("omeprazole", "40 mg", "40 mg", "", "", "Max 20 mg/day in hepatic impairment", "C"),
    ("ranitidine", "300 mg", "150 mg", "50", "Halve dose if eGFR < 50", "", "B"),
    ("furosemide", "80 mg", "40 mg", "", "", "", "C"),
    ("amitriptyline", "150 mg", "75 mg", "", "", "Caution in hepatic impairment", "C"),
    ("tramadol", "400 mg", "100 mg", "30", "Increase dosing interval if eGFR < 30", "Caution in hepatic impairment", "C"),
    ("gentamicin", "5 mg", "", "60", "Reduce dose / extend interval if eGFR < 60", "", "D"),
    ("vancomycin", "2000 mg", "1000 mg", "60", "Adjust by levels if eGFR < 60", "", "C"),
]


def build_drug_formulary(src: str, out_dir: str) -> None:
    """Emit drug_formulary.csv = curated public CDS reference, enriched with
    paediatric mg/kg + hepatic/pregnancy notes from the local pharmacology.py."""
    import re

    cols = [
        "generic_name", "inn_name", "atc_code", "max_dose_per_day", "max_single_dose",
        "dose_per_kg", "renal_adjust_egfr_threshold", "renal_adjust_rule",
        "hepatic_caution", "pregnancy_category",
    ]
    # Start from the curated reference.
    by_generic: dict[str, dict] = {}
    for g, maxd, maxs, rt, rr, hep, preg in CURATED_CDS:
        by_generic[g] = {
            "generic_name": g, "inn_name": g, "atc_code": "",
            "max_dose_per_day": maxd, "max_single_dose": maxs, "dose_per_kg": "",
            "renal_adjust_egfr_threshold": rt, "renal_adjust_rule": rr,
            "hepatic_caution": hep, "pregnancy_category": preg,
        }

    # Enrich from pharmacology.py (paediatric mg/kg, hepatic/pregnancy notes).
    if os.path.isfile(os.path.join(src, "pharmacology.py")):
        sys.path.insert(0, src)
        try:
            import pharmacology  # type: ignore

            for key, d in pharmacology.DRUGS.items():
                generic = key.split("_")[0].strip().lower()
                row = by_generic.setdefault(
                    generic,
                    {c: "" for c in cols} | {"generic_name": generic, "inn_name": generic},
                )
                notes = str(d.get("notes") or "")
                if not row["hepatic_caution"] and re.search(r"LFT|hepat|liver", notes, re.I):
                    row["hepatic_caution"] = notes
                if not row["pregnancy_category"]:
                    if re.search(r"avoid in pregnan", notes, re.I):
                        row["pregnancy_category"] = "D"
                    elif re.search(r"pregnan", notes, re.I):
                        row["pregnancy_category"] = "C"
                paedia = d.get("paedia") or {}
                m = re.match(r"([\d.]+)\s*(mcg|mg|g)/kg", str(paedia.get("dose", "")))
                if m and not row["dose_per_kg"]:
                    row["dose_per_kg"] = f"{m.group(1)} {m.group(2)}"
        except Exception as exc:  # noqa: BLE001
            print(f"WARN: could not import pharmacology.py: {exc}", file=sys.stderr)
    else:
        print("WARN: pharmacology.py not found — curated CDS only.", file=sys.stderr)

    out_path = os.path.join(out_dir, "drug_formulary.csv")
    with open(out_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for g in sorted(by_generic):
            w.writerow([by_generic[g][c] for c in cols])
    print(f"Wrote {len(by_generic)} drug rows → {out_path}")


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

    build_drug_formulary(args.src, out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
