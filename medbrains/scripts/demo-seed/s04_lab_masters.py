"""Lab tests with LOINC, units, reference + critical ranges (the 6 earlier tests are left without ranges on purpose)."""
import api, state
TESTS = [  # code, name, loinc, sample, unit, range, crit_low, crit_high, price, tat, fasting
 ("GLUF", "Glucose, fasting", "1558-6", "Plasma (fluoride)", "mg/dL", "70-100", 40, 450, 120, 4, True),
 ("K", "Potassium, serum", "2823-3", "Serum", "mmol/L", "3.5-5.1", 2.8, 6.2, 180, 4, False),
 ("NA", "Sodium, serum", "2951-2", "Serum", "mmol/L", "135-145", 120, 160, 180, 4, False),
 ("CREAT", "Creatinine, serum", "2160-0", "Serum", "mg/dL", "0.6-1.2", None, 7.0, 200, 6, False),
 ("HB", "Haemoglobin", "718-7", "Whole blood (EDTA)", "g/dL", "12-16", 7.0, 20.0, 150, 2, False),
 ("TROPI", "Troponin I, high sensitivity", "10839-9", "Serum", "ng/mL", "<0.04", None, 0.4, 1200, 1, False),
 ("PLT", "Platelet count", "777-3", "Whole blood (EDTA)", "10^3/uL", "150-400", 20, 1000, 150, 2, False),
 ("CRP", "C-reactive protein", "1988-5", "Serum", "mg/L", "<5", None, None, 450, 6, False),
 ("INR", "Prothrombin time INR", "6301-6", "Citrated plasma", "ratio", "0.8-1.2", None, 5.0, 350, 3, False),
 ("URM", "Urine routine and microscopy", "24356-8", "Urine", "", "See report", None, None, 150, 4, False),
 ("WIDAL", "Widal test", "5966-9", "Serum", "titre", "<1:80", None, None, 250, 6, False),
]
def run():
    api.login()
    D = state.S["departments"]
    cat = {c["code"]: c["id"] for c in api.get("/lab/catalog")}
    for code, name, loinc, sample, unit, rng, cl, ch, price, tat, fast in TESTS:
        if code in cat: continue
        b = dict(code=code, name=name, loinc_code=loinc, sample_type=sample, unit=unit, normal_range=rng, price=price,
                 tat_hours=tat, department_id=D["LAB"], fasting_required=fast, is_patient_orderable=True)
        if fast: b["fasting_hours"] = 8
        if cl is not None: b["critical_low"] = cl
        if ch is not None: b["critical_high"] = ch
        r = api.try_(api.post, "/lab/catalog", b)
        if r: cat[code] = r["id"]
    state.S["labs"] = cat; state.save(); print("lab tests", len(cat))
if __name__ == "__main__": run()
