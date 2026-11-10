"""Move lab orders through collect -> process -> results -> complete -> verify, with abnormal and critical values."""
import random, api, state
rnd = random.Random(11)
def params(code, ctx, crit):
    """Result rows for a test. ctx = template tag; crit = make this one critical."""
    f = lambda v, lo, hi: "low" if v < lo else "high" if v > hi else "normal"
    if code == "CBC":
        hb = 6.4 if crit else round(rnd.uniform(9.5, 14.5), 1); wbc = round(rnd.uniform(4.5, 15.5), 1)
        plt = 18 if (crit and ctx == "dengue") else (rnd.randint(60, 120) if ctx == "dengue" else rnd.randint(160, 380))
        return [("Haemoglobin", hb, "g/dL", "12-16", "critical_low" if hb < 7 else f(hb, 12, 16)),
                ("Total WBC count", wbc, "10^3/uL", "4-11", f(wbc, 4, 11)),
                ("Platelet count", round(plt / 100, 2), "lakh/cumm", "1.5-4.5", "critical_low" if plt < 20 else f(plt, 150, 400))]
    one = {"HB": ("Haemoglobin", "g/dL", "12-16", 12, 16, (8.5, 15), 6.2, "critical_low"),
           "PLT": ("Platelet count", "lakh/cumm", "1.5-4.5", 1.5, 4.5, (0.55, 1.4) if ctx == "dengue" else (1.7, 3.5), 0.16, "critical_low"),
           "K": ("Potassium", "mmol/L", "3.5-5.1", 3.5, 5.1, (3.6, 5.4), 6.7, "critical_high"),
           "NA": ("Sodium", "mmol/L", "135-145", 135, 145, (129, 143), 118, "critical_low"),
           "CREAT": ("Creatinine", "mg/dL", "0.6-1.2", 0.6, 1.2, (0.7, 2.1), 7.8, "critical_high"),
           "GLUF": ("Glucose, fasting", "mg/dL", "70-100", 70, 100, (92, 210), 486, "critical_high"),
           "HBA1C": ("HbA1c", "%", "4.0-5.6", 4.0, 5.6, (5.4, 9.8), None, None),
           "TSH": ("TSH", "uIU/mL", "0.4-4.0", 0.4, 4.0, (1.0, 11.5), None, None),
           "TROPI": ("Troponin I (hs)", "ng/mL", "<0.04", 0, 0.04, (0.005, 0.03), 1.24, "critical_high"),
           "CRP": ("CRP", "mg/L", "<5", 0, 5, (2, 48), None, None),
           "INR": ("INR", "ratio", "0.8-1.2", 0.8, 1.2, (0.9, 1.3), 5.6, "critical_high")}
    if code in one:
        n, u, r, lo, hi, (a, b), cv, cflag = one[code]
        if crit and cv is not None: return [(n, cv, u, r, cflag)]
        v = round(rnd.uniform(a, b), 2 if hi < 1 else 1)
        return [(n, v, u, r, f(v, lo, hi))]
    if code == "LFT":
        alt = rnd.randint(18, 140)
        return [("SGPT (ALT)", alt, "U/L", "7-56", f(alt, 7, 56)), ("Total bilirubin", round(rnd.uniform(0.4, 2.2), 1), "mg/dL", "0.1-1.2", "normal")]
    if code == "LIPID":
        tc, ldl = rnd.randint(150, 270), rnd.randint(80, 190)
        return [("Total cholesterol", tc, "mg/dL", "<200", "high" if tc >= 200 else "normal"),
                ("LDL cholesterol", ldl, "mg/dL", "<100", "high" if ldl >= 100 else "normal"),
                ("HDL cholesterol", rnd.randint(32, 62), "mg/dL", ">40", "normal")]
    if code == "DENGUE":
        pos = ctx == "dengue"
        return [("Dengue NS1 antigen", "Positive" if pos else "Negative", "", "Negative", "abnormal" if pos else "normal")]
    if code == "WIDAL":
        return [("S. Typhi O", "1:160", "titre", "<1:80", "abnormal"), ("S. Typhi H", "1:160", "titre", "<1:80", "abnormal")]
    if code == "URM":
        pc = rnd.choice([2, 4, 18, 30])
        return [("Pus cells", f"{pc}/hpf", "", "0-5/hpf", "abnormal" if pc > 5 else "normal")]
    return [("Result", "Within normal limits", "", "", "normal")]
def run():
    api.login()
    labs = {v: k for k, v in state.S["labs"].items()}
    opd = {e["encounter"]: e for e in state.S["opd"].values()}
    from clinical import T
    pts = {p["id"]: p["uhid"] for p in api.get("/patients?per_page=200")["patients"]}
    done = state.bucket("lab")
    orders = api.get("/lab/orders?per_page=500")["orders"]
    crit_left = {"PLT": 1, "CBC": 1, "K": 1, "GLUF": 1, "TROPI": 1, "CREAT": 1}
    for i, o in enumerate(sorted(orders, key=lambda o: o["created_at"])):
        if o["id"] in done or o["status"] != "ordered": continue
        code = labs.get(o["test_id"]); e = opd.get(o["encounter_id"])
        ctx = "dengue" if e and T[e["dept"]][e["tpl"]][1] == "1D20" else ""
        roll = rnd.random()
        stage = "ordered" if (e and e["state"] == "in_consultation" and roll < 0.5) else \
                "collected" if roll < 0.15 else "processing" if roll < 0.27 else "verified" if roll < 0.85 else "completed"
        if stage == "ordered": done[o["id"]] = "ordered"; continue
        oid = o["id"]
        if not api.try_(api.put, f"/lab/orders/{oid}/collect", dict(patient_identifier=pts[o["patient_id"]], sample_barcode=f"S{2610250000 + i}")): continue
        done[oid] = "collected"
        if stage == "collected": continue
        api.try_(api.put, f"/lab/orders/{oid}/process", {}); done[oid] = "processing"
        if stage == "processing": continue
        crit = crit_left.get(code, 0) > 0 and (ctx == "dengue" or code != "PLT") and rnd.random() < 0.6
        if crit: crit_left[code] -= 1
        rows = [dict(parameter_name=n, value=str(v), unit=u, normal_range=r, flag=fl) for n, v, u, r, fl in params(code, ctx, crit)]
        if not api.try_(api.post, f"/lab/orders/{oid}/results", dict(results=rows)): continue
        api.try_(api.put, f"/lab/orders/{oid}/complete", {}); done[oid] = "completed"
        if stage == "verified" and api.try_(api.put, f"/lab/orders/{oid}/verify", {}): done[oid] = "verified"
        state.save()
    ack_and_verify(done)
    state.save()
    from collections import Counter; print(Counter(done.values()), "criticals left", crit_left)
KEEP_UNACKED = ("Troponin I (hs)", "Potassium")   # left open on purpose: "unacknowledged critical values"
def ack_and_verify(done):
    for a in api.get("/lab/critical-alerts"):
        if a["acknowledged_at"] or a["parameter_name"] in KEEP_UNACKED: continue
        if api.try_(api.put, f"/lab/critical-alerts/{a['id']}/acknowledge", dict(readback_value=a["value"])):
            if done.get(a["order_id"]) == "completed" and api.try_(api.put, f"/lab/orders/{a['order_id']}/verify", {}):
                done[a["order_id"]] = "verified"
if __name__ == "__main__": run()
