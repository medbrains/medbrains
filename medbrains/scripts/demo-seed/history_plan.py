"""Deterministic plan of a hospital's past year, as historical-import records.

Seasonality: monsoon (Jun-Oct) brings fever, dengue, typhoid and gastroenteritis;
winter (Nov-Feb) brings respiratory illness. Tariffs are a tier-2 Indian private
hospital's. `scale` multiplies the daily volumes; run_history.py solves it for
the target revenue.
"""
import datetime as dt
import random

from clinical import T, vitals
from s06_lab import params
from s08_pharmacy import qty

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
DOCS = {"GEN-MEDICINE": ["dr_arjun", "dr_sunil"], "PAED": ["dr_kavya"], "ORTHO": ["dr_rohan"], "CARDIO": ["dr_fatima"],
        "OBGYN": ["dr_ananya"], "ENT": ["dr_vivek"], "SURG": ["dr_salim"], "EMERG": ["dr_neha_er"]}
FEE = {"dr_arjun": 600, "dr_sunil": 500, "dr_kavya": 700, "dr_rohan": 800, "dr_fatima": 1000, "dr_ananya": 800,
       "dr_vivek": 600, "dr_salim": 700, "dr_neha_er": 800}
LAB_PRICE = {"CBC": 350, "CREAT": 200, "CRP": 450, "DENGUE": 900, "GLUF": 120, "HB": 150, "HBA1C": 550, "INR": 350, "K": 180,
             "LFT": 700, "LIPID": 650, "NA": 180, "PLT": 150, "TROPI": 1200, "TSH": 450, "URM": 150, "WIDAL": 250}
DRUG_PRICE = {"AMLO5": 3, "AMOX500": 9, "AMXCL": 95, "ATOR10": 7, "AZI500": 22, "CEFT1G": 55, "CETI10": 2, "DICLO50": 2,
              "IFA": 1, "INSH40": 160, "MET500": 3, "ONDA4": 5, "ORS": 20, "PAN40": 6, "PCM500": 2, "SALB100": 140,
              "TELMI40": 6, "TRAM50": 8}
MONSOON = {"1D20", "1A07", "1A40.Z"}
WINTER = {"CA00", "CA23", "BD10", "CA01"}
FIRST_M = "Aarav Vihaan Arjun Rohit Sanjay Ravi Suresh Mahesh Ganesh Karthik Mohammed Imran Joseph Thomas Gurpreet Harish Prakash Deepak Manoj Anil Vijay Rajesh Naveen Sunil Tarun Bikash Sourav Pranav Kiran Ashok".split()
FIRST_F = "Ananya Diya Priya Kavya Lakshmi Meena Sunita Geeta Anjali Pooja Neha Ayesha Fatima Mary Harpreet Revathi Divya Shreya Swati Rekha Kamala Padma Shalini Nisha Bhavna Moumita Rupa Asha Usha Zoya".split()
LAST = "Sharma Verma Gupta Yadav Singh Kumar Reddy Rao Naidu Iyer Iyengar Pillai Nair Menon Patil Jadhav Deshmukh Shah Patel Desai Ghosh Das Banerjee Sen Bora Gogoi Mohanty Khan Qureshi Siddiqui Fernandes D'Souza Hegde Gowda Shetty Murugan Subramanian Kaur Gill Mishra".split()
CITIES = [("Lucknow", "Uttar Pradesh", "hi"), ("Chennai", "Tamil Nadu", "ta"), ("Pune", "Maharashtra", "mr"), ("Kochi", "Kerala", "ml"),
          ("Bengaluru", "Karnataka", "kn"), ("Hyderabad", "Telangana", "te"), ("Kolkata", "West Bengal", "bn"), ("Ahmedabad", "Gujarat", "gu")]
INSURERS = [("Star Health (demo)", "private"), ("New India Assurance (demo)", "private"), ("HDFC ERGO (demo)", "private"),
            ("Niva Bupa (demo)", "private"), ("PM-JAY (demo)", "pmjay"), ("CGHS (demo)", "cghs")]
# key: dept, doctor, working diagnosis, ICD-11 (None = text only), LOS range, per-stay lines, per-day lines, insured share
IPD_CASES = [
 ("GEN-MEDICINE", "Dengue fever with thrombocytopenia", "1D20", (3, 5), [("PLT-TX", "Platelet transfusion (SDP)", "ipd", 11000)], 0.3, 1),
 ("GEN-MEDICINE", "Enteric fever", "1A07", (4, 6), [], 0.3, 1),
 ("GEN-MEDICINE", "Community-acquired pneumonia", None, (4, 7), [("ICU", "ICU bed charge (2 days)", "ipd", 24000)], 0.35, 1),
 ("GEN-MEDICINE", "Acute exacerbation of COPD", None, (5, 8), [("NIV", "NIV / BiPAP support", "ipd", 9000)], 0.3, 1),
 ("GEN-MEDICINE", "Uncontrolled type 2 diabetes", "5A11", (3, 5), [], 0.3, 1),
 ("GEN-MEDICINE", "Acute gastroenteritis with dehydration", "1A40.Z", (2, 3), [], 0.2, 1),
 ("CARDIO", "Unstable angina - coronary angiography", "BA40.Z", (2, 3), [("CAG", "Coronary angiography", "procedure", 18000)], 0.5, 1),
 ("CARDIO", "Coronary artery disease - PTCA with one stent", None, (3, 4), [("PTCA", "PTCA with drug-eluting stent package", "procedure", 165000)], 0.6, 0),
 ("CARDIO", "Congestive heart failure", "BD10", (5, 8), [("ECHO", "2D echocardiography", "procedure", 2800)], 0.4, 1),
 ("SURG", "Acute appendicitis - laparoscopic appendicectomy", "DB10", (2, 3), [("PKG-APP", "Laparoscopic appendicectomy package", "ot", 55000)], 0.45, 0),
 ("SURG", "Inguinal hernia - laparoscopic mesh repair", "DD51", (2, 2), [("PKG-HER", "Laparoscopic hernia repair (mesh) package", "ot", 65000)], 0.45, 0),
 ("SURG", "Cholelithiasis - laparoscopic cholecystectomy", None, (2, 3), [("PKG-CHOLE", "Laparoscopic cholecystectomy package", "ot", 70000)], 0.45, 0),
 ("ORTHO", "Fracture distal radius - ORIF", "NC32", (2, 3), [("PKG-ORIF", "ORIF with plating package", "ot", 72000), ("IMPL", "Locking plate implant", "consumable", 18000)], 0.4, 0),
 ("ORTHO", "Osteoarthritis knee - total knee replacement", "FA01", (5, 6), [("PKG-TKR", "Total knee replacement (unilateral) package", "ot", 210000)], 0.55, 0),
 ("OBGYN", "Term pregnancy - normal vaginal delivery", None, (2, 2), [("PKG-NVD", "Normal vaginal delivery package", "ipd", 35000)], 0.25, 0),
 ("OBGYN", "Term pregnancy - lower segment caesarean section", None, (3, 4), [("PKG-LSCS", "LSCS package", "ot", 65000)], 0.3, 0),
 ("OBGYN", "Fibroid uterus - total abdominal hysterectomy", None, (3, 4), [("PKG-TAH", "Total abdominal hysterectomy package", "ot", 85000)], 0.4, 0),
 ("ENT", "Chronic tonsillitis - tonsillectomy", "CA03", (1, 2), [("PKG-TONS", "Tonsillectomy package", "ot", 38000)], 0.35, 0),
 ("PAED", "Acute gastroenteritis in a child", "1A40.Z", (2, 3), [], 0.2, 1),
 ("PAED", "Dengue fever in a child", "1D20", (3, 5), [("PLT-TX", "Platelet transfusion (SDP)", "ipd", 11000)], 0.25, 1),
]
DAY = [("ROOM", "Bed charge (per day)", 2500), ("NURS", "Nursing charges (per day)", 800), ("DRV", "Consultant visit (per day)", 700),
       ("MED", "Medicines and consumables (per day)", 1800)]


class Plan:
    def __init__(self, go_live, months, scale, existing_uhids, seed=2026):
        self.rnd = random.Random(seed)
        self.go_live, self.scale, self.existing = go_live, scale, existing_uhids
        self.start = (go_live - dt.timedelta(days=round(months * 30.44))).replace(hour=0, minute=0, second=0)
        self.days, self.patients, self.n = {}, [], {k: 0 for k in "PVALDBC"}
        self.revenue = 0.0

    def nid(self, k):
        self.n[k] += 1
        return f"HX-{k}{self.n[k]:06d}"

    def add(self, day, rec):
        self.days.setdefault(day, []).append(rec)

    def season(self, d):
        m = d.month
        return 1.25 if m in (7, 8, 9) else 1.1 if m in (6, 10) else 1.15 if m in (12, 1) else 0.9 if m in (4, 5) else 1.0

    def new_patient(self, when, age=None, gender=None):
        r = self.rnd
        gender = gender or r.choice(["male", "female"])
        age = age if age is not None else r.choice([r.randint(1, 13), r.randint(14, 40), r.randint(41, 65), r.randint(66, 90)])
        city, state, lang = r.choice(CITIES)
        ext = self.nid("P")
        rec = dict(kind="patient", external_id=ext, first_name=r.choice(FIRST_M if gender == "male" else FIRST_F),
                   last_name=r.choice(LAST), gender=gender, phone=f"{9000010000 + len(self.patients)}",
                   date_of_birth=(when.date() - dt.timedelta(days=int(age * 365.25) + r.randint(0, 300))).isoformat(),
                   registered_at=when.isoformat(), city=city, state=state, preferred_language=lang,
                   category=r.choice(["general"] * 8 + ["insurance", "pmjay"]))
        self.add(when.date(), rec)
        p = dict(key=ext, age=age, gender=gender, reg=when)
        self.patients.append(p)
        return p

    def pick_patient(self, when):
        r = self.rnd
        if self.patients and r.random() < 0.42:
            p = r.choice(self.patients)
            if p["reg"] <= when:   # a returning patient must already be registered
                return p
        if self.existing and r.random() < 0.03:
            return dict(key=r.choice(self.existing), age=40, gender=r.choice(["male", "female"]))
        return self.new_patient(when)

    def template(self, dept, month):
        weights = []
        for t in T[dept]:
            w = 1.0
            if t[1] in MONSOON: w *= 4 if month in (6, 7, 8, 9) else 2 if month == 10 else 0.4
            if t[1] in WINTER: w *= 3 if month in (11, 12, 1, 2) else 0.6
            weights.append(w)
        return self.rnd.choices(T[dept], weights)[0]

    def dept_for(self, p):
        if p["age"] < 14: return "PAED"
        opts = ["GEN-MEDICINE"] * 5 + ["ORTHO", "ORTHO", "ENT", "SURG"] + (["CARDIO"] * 2 if p["age"] > 40 else []) + \
               (["OBGYN"] * 3 if p["gender"] == "female" and 18 <= p["age"] <= 50 else [])
        return self.rnd.choice(opts)

    def bill(self, day, patient, episode, at, lines, mode_mix=True, pay_share=1.0, paid_at=None):
        r = self.rnd
        total = sum(q * u * (1 + tax / 100) for _, _, _, q, u, tax in lines)
        self.revenue += total
        rec = dict(kind="invoice", external_id=self.nid("B"), patient=patient, invoiced_at=at.isoformat(),
                   items=[dict(charge_code=c, description=d, source=s, quantity=q, unit_price=u, tax_percent=tax) for c, d, s, q, u, tax in lines],
                   payments=[], **episode)
        amount = round(total * pay_share, 2)
        if amount > 0:
            mode = r.choices(["cash", "upi", "card"], [35, 45, 20])[0] if mode_mix else r.choice(["upi", "card", "bank_transfer"])
            rec["payments"].append(dict(amount=amount, mode=mode, paid_at=(paid_at or at).isoformat(),
                                        reference=None if mode == "cash" else f"HX{r.randint(10**8, 10**9)}"))
        self.add(day, rec)
        return rec, total

    def visit(self, when, emergency=False):
        r = self.rnd
        p = self.pick_patient(when)
        dept = "EMERG" if emergency else self.dept_for(p)
        tdept = "GEN-MEDICINE" if dept == "EMERG" else dept
        tpl = self.template(tdept, when.month)
        doc = r.choice(DOCS[dept])
        ext = self.nid("V")
        self.add(when.date(), dict(kind="visit", external_id=ext, patient=p["key"], department=dept, doctor=doc,
                                   visited_at=when.isoformat(), visit_type="emergency" if emergency else r.choice(["walk_in"] * 3 + ["booked", "follow_up"]),
                                   chief_complaint=tpl[0], vitals=vitals(tpl[5], r, p["age"]),
                                   diagnoses=[dict(icd_code=tpl[1], icd_system="icd11", description=tpl[2], is_primary=True)]))
        lines = [("CONSULT", f"OPD consultation - {doc}", "opd", 1, FEE[doc], 0)]
        if p["key"].startswith("HX-P") and r.random() < 0.5:
            lines.append(("REG", "Registration fee", "registration", 1, 100, 0))
        ep = dict(visit=ext)
        late = when + dt.timedelta(hours=6) >= self.go_live   # results and dispense would land after go-live
        if tpl[4] and not late and r.random() < 0.7:
            for test in tpl[4][: r.randint(1, len(tpl[4]))]:
                o = when + dt.timedelta(minutes=20)
                res = [dict(parameter_name=n, value=str(v), unit=u or None, normal_range=rg or None, flag=f)
                       for n, v, u, rg, f in params(test, "dengue" if tpl[1] == "1D20" else "", r.random() < 0.02)]
                self.add(when.date(), dict(kind="lab_order", external_id=self.nid("L"), patient=p["key"], test=test, ordered_at=o.isoformat(),
                                           collected_at=(o + dt.timedelta(minutes=25)).isoformat(),
                                           reported_at=(o + dt.timedelta(hours=r.randint(2, 5))).isoformat(), results=res, **ep))
                lines.append((test, f"Lab: {test}", "lab", 1, LAB_PRICE[test], 0))
        rx = [x for x in tpl[3] if x[0] in DRUG_PRICE]
        if rx and not late and r.random() < 0.75:
            items = [dict(drug=c, quantity=1 if c in ("SALB100", "AMXCL", "INSH40") else qty(f, du), unit_price=DRUG_PRICE[c]) for c, _, f, du, _ in rx]
            self.add(when.date(), dict(kind="dispense", external_id=self.nid("D"), patient=p["key"],
                                       dispensed_at=(when + dt.timedelta(hours=1)).isoformat(), items=items, **ep))
            lines += [(i["drug"], f"Pharmacy: {i['drug']}", "pharmacy", i["quantity"], i["unit_price"], 12) for i in items]
        roll = r.random()
        self.bill(when.date(), p["key"], ep, when + dt.timedelta(minutes=10), lines,
                  pay_share=1.0 if roll < 0.92 else 0.5 if roll < 0.97 else 0.0)

    def admission(self, when):
        r = self.rnd
        case = r.choice(IPD_CASES)
        dept, dx, icd, (lo, hi), stay, insured_p, per_day = case
        if dept == "PAED":
            p = self.new_patient(when, age=r.randint(1, 12))
        elif dept == "OBGYN":
            p = self.new_patient(when, age=r.randint(22, 48), gender="female")
        else:
            p = self.pick_patient(when)
            if p["age"] < 14: p = self.new_patient(when, age=r.randint(20, 80))
        los = r.randint(lo, hi)
        out = (when + dt.timedelta(days=los)).replace(hour=r.randint(10, 15))
        if out >= self.go_live:  # still in hospital at go-live: admitted live, not history
            return
        doc = r.choice(DOCS[dept])
        ext = self.nid("A")
        rec = dict(kind="admission", external_id=ext, patient=p["key"], department=dept, doctor=doc, admitted_at=when.isoformat(),
                   discharged_at=out.isoformat(), admission_source=r.choice(["opd", "opd", "er", "referral"]), diagnosis=dx,
                   discharge_type="normal" if r.random() < 0.96 else "dama",
                   discharge_summary=f"Admitted with {dx.lower()}. Treated and discharged in stable condition.")
        if icd: rec["diagnoses"] = [dict(icd_code=icd, icd_system="icd11", description=dx.split(" - ")[0], is_primary=True)]
        self.add(when.date(), rec)
        lines = [(c, d, s, 1, price, 0) for c, d, s, price in stay]
        days = los if per_day else max(0, los - 2)
        lines += [(c, d, "ipd", days, price, 0) for c, d, price in DAY if days]
        lines.append(("LAB-IP", "Laboratory investigations during stay", "lab", 1, r.choice([1800, 2600, 3400, 4800]), 0))
        insured = r.random() < insured_p
        share = 0.1 if insured else (1.0 if r.random() < 0.94 else 0.6)
        bill, total = self.bill(out.date(), p["key"], dict(admission=ext), out, lines, mode_mix=False, pay_share=share, paid_at=out)
        if insured:
            submitted = out + dt.timedelta(days=r.randint(1, 3))
            if submitted >= self.go_live:
                return
            age_days = (self.go_live - submitted).days
            insurer, scheme = r.choice(INSURERS)
            claim_amt = round(total * 0.9, 2)
            status, approved, settled, settled_at = "claim_submitted", None, None, None
            if r.random() < 0.05 and age_days > 20:
                status, approved = "claim_rejected", 0
            elif age_days > 45:
                approved = round(claim_amt * r.uniform(0.85, 1.0), 2)
                settled = approved
                status, settled_at = "settled", (submitted + dt.timedelta(days=r.randint(20, 40))).isoformat()
                if dt.datetime.fromisoformat(settled_at) >= self.go_live:
                    status, settled, settled_at = "claim_approved", None, None
            elif age_days > 15:
                status, approved = "claim_approved", round(claim_amt * r.uniform(0.85, 1.0), 2)
            self.add(out.date(), dict(kind="claim", external_id=self.nid("C"), invoice=bill["external_id"], insurance_provider=insurer,
                                      policy_number=f"HX-POL-{r.randint(100000, 999999)}", claim_type="cashless", scheme_type=scheme,
                                      status=status, claim_amount=claim_amt, approved_amount=approved, settled_amount=settled,
                                      submitted_at=submitted.isoformat(), settled_at=settled_at))

    def build(self):
        r = self.rnd
        d = self.start
        while d < self.go_live:
            wd = d.weekday()
            day_factor = {6: 0.55, 0: 1.25, 5: 0.9}.get(wd, 1.0) * self.season(d)
            for _ in range(int(round(110 * self.scale * day_factor * r.uniform(0.9, 1.1)))):
                self.visit(d.replace(hour=r.randint(9, 16), minute=r.randint(0, 59)))
            for _ in range(int(round(3 * self.scale * self.season(d)))):
                self.visit(d.replace(hour=r.randint(0, 23), minute=r.randint(0, 59)), emergency=True)
            for _ in range(int(round(4.2 * self.scale * self.season(d) * r.uniform(0.8, 1.2)))):
                self.admission(d.replace(hour=r.randint(8, 20), minute=r.randint(0, 59)))
            d += dt.timedelta(days=1)
        return self

    def batches(self, size=1500):
        """Chunks in generation order: every record comes after the records it points at,
        so each chunk's references are in it or an earlier one. Small chunks keep each
        import transaction short."""
        flat = [rec for day in sorted(self.days) for rec in self.days[day]]
        for i in range(0, len(flat), size):
            yield flat[i:i + size]

if __name__ == "__main__":   # self-check: no record dated at/after go-live, revenue near the target
    gl = dt.datetime(2026, 10, 25, tzinfo=IST)
    p = Plan(gl, 12, 1.0, ["DMO-000001"]).build()
    reg = {rec["external_id"]: rec["registered_at"] for recs in p.days.values() for rec in recs if rec["kind"] == "patient"}
    for recs in p.days.values():
        for rec in recs:
            if rec["kind"] in ("visit", "admission") and rec["patient"] in reg:
                assert reg[rec["patient"]] <= rec.get("visited_at", rec.get("admitted_at")), rec["external_id"]
    times = [v for recs in p.days.values() for rec in recs for k, v in rec.items() if k.endswith("_at") and v]
    assert max(dt.datetime.fromisoformat(t) for t in times) < gl
    n = sum(len(v) for v in p.days.values())
    print(f"records {n:,} revenue Rs {p.revenue / 1e7:.2f} crore batches {sum(1 for _ in p.batches())}")
