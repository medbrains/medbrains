"""More formulary drugs (incl. Schedule H, H1, NDPS, LASA, cold chain) + batches: near-expiry, low stock."""
import api, state
# code, name, generic, category, unit, price, schedule, controlled, atc, aware, reorder, extra
DRUGS = [
 ("AZI500", "Azithromycin 500 mg tablet", "Azithromycin", "Antibiotic", "tablet", 22, "H", False, "J01FA10", "watch", 40, {}),
 ("CEFT1G", "Ceftriaxone 1 g injection", "Ceftriaxone", "Antibiotic", "vial", 55, "H", False, "J01DD04", "watch", 30, {}),
 ("AMLO5", "Amlodipine 5 mg tablet", "Amlodipine", "Antihypertensive", "tablet", 3, "H", False, "C08CA01", None, 60, {}),
 ("TELMI40", "Telmisartan 40 mg tablet", "Telmisartan", "Antihypertensive", "tablet", 6, "H", False, "C09CA07", None, 60, {}),
 ("INSH40", "Human insulin 40 IU/mL vial", "Insulin human", "Antidiabetic", "vial", 160, "H", False, "A10AB01", None, 20,
  {"needs_cold_chain": True, "storage_conditions": "2-8 C, do not freeze"}),
 ("SALB100", "Salbutamol 100 mcg inhaler", "Salbutamol", "Bronchodilator", "inhaler", 140, "H", False, "R03AC02", None, 15, {}),
 ("CETI10", "Cetirizine 10 mg tablet", "Cetirizine", "Antihistamine", "tablet", 2, "OTC", False, "R06AE07", None, 50, {}),
 ("ONDA4", "Ondansetron 4 mg tablet", "Ondansetron", "Antiemetic", "tablet", 5, "H", False, "A04AA01", None, 40, {}),
 ("DICLO50", "Diclofenac 50 mg tablet", "Diclofenac", "NSAID", "tablet", 2, "H", False, "M01AB05", None, 50, {}),
 ("NS500", "Sodium chloride 0.9% 500 mL infusion", "Sodium chloride", "IV fluid", "bottle", 35, "H", False, "B05BB01", None, 40, {}),
 ("TRAM50", "Tramadol 50 mg capsule", "Tramadol", "Opioid analgesic", "capsule", 8, "H1", True, "N02AX02", None, 30,
  {"max_dose_per_day": "400 mg", "black_box_warning": "Risk of dependence; respiratory depression with CNS depressants"}),
 ("MORPH10", "Morphine 10 mg/mL injection", "Morphine", "Opioid analgesic", "ampoule", 45, "NDPS", True, "N02AA01", None, 10,
  {"max_dose_per_day": "As titrated; usual 10 mg 4-hourly", "black_box_warning": "NDPS narcotic: dual-lock storage, register entry for every movement",
   "storage_conditions": "Double-locked narcotics cabinet"}),
 ("HYDX25", "Hydroxyzine 25 mg tablet", "Hydroxyzine", "Antihistamine", "tablet", 4, "H", False, "N05BB01", None, 30,
  {"is_lasa": True, "lasa_group": "Hydroxyzine / Hydralazine"}),
 ("HYDL25", "Hydralazine 25 mg tablet", "Hydralazine", "Antihypertensive", "tablet", 4, "H", False, "C02DB02", None, 30,
  {"is_lasa": True, "lasa_group": "Hydroxyzine / Hydralazine"}),
 ("IFA", "Ferrous sulphate + folic acid tablet", "Ferrous sulfate/folic acid", "Haematinic", "tablet", 1, "OTC", False, "B03AD03", None, 100, {}),
 ("AMXCL", "Amoxicillin-clavulanate 228 mg/5 mL syrup", "Amoxicillin/clavulanic acid", "Antibiotic", "bottle", 95, "H", False, "J01CR02", "access", 15, {}),
]
# code -> list of (batch, expiry, qty, rate)
BATCHES = {
 "AZI500": [("AZ2611A", "2026-11-12", 60, 14), ("AZ2808B", "2028-08-31", 200, 14)],  # near expiry
 "CEFT1G": [("CF2705", "2027-05-31", 12, 38)],                                         # low stock (reorder 30)
 "AMLO5": [("AM2803", "2028-03-31", 400, 1.5)], "TELMI40": [("TE2802", "2028-02-28", 300, 3.5)],
 "INSH40": [("IN2702", "2027-02-28", 8, 120)],                                         # low stock (reorder 20), cold chain
 "SALB100": [("SB2706", "2027-06-30", 25, 100)],
 "CETI10": [("CE2611", "2026-11-18", 120, 0.8), ("CE2712", "2027-12-31", 300, 0.8)],     # near expiry
 "ONDA4": [("ON2611", "2026-11-05", 45, 3)],                                           # near expiry (11 days)
 "DICLO50": [("DI2709", "2027-09-30", 500, 1)], "NS500": [("NS2704", "2027-04-30", 150, 22)],
 "TRAM50": [("TR2707", "2027-07-31", 100, 5)], "MORPH10": [("MO2706", "2027-06-30", 20, 30)],
 "HYDX25": [("HX2708", "2027-08-31", 150, 2)], "HYDL25": [("HL2708", "2027-08-31", 150, 2)],
 "IFA": [("IF2612", "2026-12-20", 1000, 0.4)], "AMXCL": [("AX2611", "2026-11-22", 10, 70)],   # near expiry + low stock
}
def run():
    api.login()
    cat = {c["code"]: c for c in api.get("/pharmacy/catalog")}
    for code, name, gen, category, unit, price, sch, ctl, atc, aware, reorder, extra in DRUGS:
        if code in cat: continue
        body = dict(code=code, name=name, generic_name=gen, inn_name=gen, category=category, unit=unit, base_price=price,
                    tax_percent=12 if sch != "OTC" else 5, reorder_level=reorder, drug_schedule=sch, is_controlled=ctl,
                    atc_code=atc, formulary_status="approved", batch_tracking_required=True,
                    manufacturer="Demo Pharma Ltd (fictional)", refill_policy="never" if ctl else "doctor_approval", **extra)
        if aware: body["aware_category"] = aware
        r = api.try_(api.post, "/pharmacy/catalog", body)
        if r: cat[code] = r
    state.S["drugs"] = {k: v["id"] for k, v in cat.items()}
    done = state.bucket("batches")
    for code, rows in BATCHES.items():
        for b, exp, qty, rate in rows:
            if b in done or code not in cat: continue
            r = api.try_(api.post, "/pharmacy/batches", dict(catalog_item_id=cat[code]["id"], batch_number=b, expiry_date=exp,
                     manufacture_date="2025-11-01", quantity_received=qty, purchase_rate=rate, selling_rate=float(cat[code]["base_price"]),
                     supplier_info="Demo Distributors (fictional)", invoice_number=f"PUR-{b}"))
            if r: done[b] = r["id"]
    state.save(); print("drugs", len(cat), "batches", len(done))
if __name__ == "__main__": run()
