"""Today's OPD: an encounter per patient (+ second-department visits), queue states, vitals, ICD-11 diagnoses,
prescriptions, lab orders, follow-up appointments. Past + upcoming appointments.
Backdating is not possible through the API (see report), so visits are all dated today."""
import random, datetime as dt, api, state
from clinical import T, vitals, PENICILLINS, NSAIDS
rnd = random.Random(7)
TODAY = dt.date(2026, 10, 25)
DOCS = {"GEN-MEDICINE": ["dr_arjun", "dr_sunil"], "PAED": ["dr_kavya"], "ORTHO": ["dr_rohan"], "CARDIO": ["dr_fatima"],
        "OBGYN": ["dr_ananya"], "ENT": ["dr_vivek"], "SURG": ["dr_salim"]}
def age_of(p): return (TODAY - dt.date.fromisoformat(p["date_of_birth"])).days // 365 if p.get("date_of_birth") else 40
def pick_dept(p, a):
    if a < 14: return "PAED"
    opts = ["GEN-MEDICINE"] * 4 + ["ORTHO", "ENT", "SURG"] + (["CARDIO"] * 2 if a > 40 else []) + \
           (["OBGYN"] * 2 if p["gender"] == "female" and 18 <= a <= 50 else [])
    return rnd.choice(opts)
def allergy_blocks(pid):
    names = {a["allergen_name"].lower() for a in api.get(f"/patients/{pid}/allergies")}
    blocked = set()
    if "penicillin" in names: blocked |= PENICILLINS
    if names & {"aspirin", "ibuprofen"}: blocked |= NSAIDS
    if "metformin" in names: blocked.add("MET500")
    return blocked
def run():
    api.login()
    S, U, D, DR = state.S, state.S["users"], state.S["departments"], state.S["drugs"]
    labs = S["labs"]
    pts = api.get("/patients?per_page=200")["patients"]
    enc = state.bucket("opd")          # key -> {encounter, queue, dept, doctor, patient, plan}
    plan = []
    for p in sorted(pts, key=lambda x: x["uhid"]):
        a = age_of(p); d = pick_dept(p, a)
        plan.append((p, a, d, "walk_in"))
        if rnd.random() < 0.35 and a >= 14:
            d2 = rnd.choice([x for x in DOCS if x not in (d, "PAED")])
            plan.append((p, a, d2, "referral"))
    rnd.shuffle(plan)
    for p, a, d, vt in plan:
        key = f"{p['uhid']}:{d}"
        if key in enc: continue
        doc = rnd.choice(DOCS[d]); tpl = rnd.choice(T[d])
        body = dict(patient_id=p["id"], department_id=D[d], doctor_id=U[doc], visit_type=vt, chief_complaint=tpl[0])
        try:
            r = api.post("/opd/encounters", body)
        except api.ApiError as e:
            print("enc", key, e.code, e.body[:160]); continue
        enc[key] = dict(encounter=r["encounter"]["id"], queue=r["queue"]["id"], dept=d, doctor=doc, patient=p["id"],
                        uhid=p["uhid"], age=a, tpl=T[d].index(tpl), token=r["token_number"], state="waiting")
        state.save()
    # queue progression per doctor: earliest tokens completed, then in-consultation, called, waiting; ~8% no-show
    by_doc = {}
    for k, e in enc.items(): by_doc.setdefault(e["doctor"], []).append((k, e))
    for doc, rows in by_doc.items():
        rows.sort(key=lambda kv: kv[1]["queue"])  # creation order is roughly token order within a doctor
        n = len(rows)
        for i, (k, e) in enumerate(rows):
            if e["state"] != "waiting": continue
            frac = i / max(n, 1)
            target = "completed" if frac < 0.55 else "in_consultation" if frac < 0.65 else "called" if frac < 0.72 else "waiting"
            if target == "completed" and rnd.random() < 0.12: target = "no_show"
            e["target"] = target
            advance(e, labs, DR, rnd)
            state.save()
    followups_and_appointments(enc, U, D)
    state.save()
    print("opd encounters", len(enc))

def advance(e, labs, DR, rnd):
    q, E, target = e["queue"], e["encounter"], e["target"]
    tpl = T[e["dept"]][e["tpl"]]
    if target == "no_show":
        api.try_(api.put, f"/opd/queue/{q}/no-show", {}); e["state"] = "no_show"; return
    if target in ("completed", "in_consultation", "called") or rnd.random() < 0.5:
        if api.try_(api.post, f"/opd/encounters/{E}/vitals", vitals(tpl[5], rnd, e["age"])): e["vitals"] = True
    if target == "waiting": return
    api.try_(api.put, f"/opd/queue/{q}/call", {}); e["state"] = "called"
    if target == "called": return
    api.try_(api.put, f"/opd/queue/{q}/start", {}); e["state"] = "in_consultation"
    api.try_(api.post, f"/opd/encounters/{E}/diagnoses", dict(icd_code=tpl[1], icd_system="icd11", description=tpl[2],
             is_primary=True, severity="moderate" if tpl[5] in ("htn", "resp", "fever") else "mild", certainty="confirmed"))
    for t in tpl[4]:
        r = api.try_(api.post, "/lab/orders", dict(patient_id=e["patient"], encounter_id=E, test_id=labs[t],
                     priority="urgent" if t in ("TROPI", "K", "PLT") else "routine"))
        if r: e.setdefault("lab_orders", []).append(r.get("id") or r.get("order", {}).get("id"))
    if target == "in_consultation": return
    blocked = allergy_blocks(e["patient"])
    items = [dict(drug_name=_name(c), catalog_item_id=DR[c], dosage=ds, frequency=f, duration=du, route="oral" if c != "SALB100" else "inhalation",
                  instructions=ins) for c, ds, f, du, ins in tpl[3] if c not in blocked]
    if items:
        r = api.try_(api.post, f"/opd/encounters/{E}/prescriptions", dict(items=items))
        if r: e["rx"] = r["prescription"]["id"]
    api.try_(api.put, f"/opd/queue/{q}/complete", {}); e["state"] = "completed"

_names = {}
def _name(code):
    if not _names:
        for c in api.get("/pharmacy/catalog"): _names[c["code"]] = c["name"]
    return _names[code]

def followups_and_appointments(enc, U, D):
    ap = state.bucket("appointments")
    done = [e for e in enc.values() if e["state"] == "completed"]
    for i, e in enumerate(done):
        if i % 5 >= 2 or f"fu:{e['encounter']}" in ap: continue          # ~40% get a follow-up
        day = TODAY + dt.timedelta(days=rnd.choice([3, 5, 7, 7, 10, 14]))
        h = 9 + i % 7; slot = f"{h:02d}:{(i * 15) % 60:02d}"
        end = (dt.datetime.combine(day, dt.time(h, (i * 15) % 60)) + dt.timedelta(minutes=15)).strftime("%H:%M")
        r = api.try_(api.post, "/opd/appointments", dict(patient_id=e["patient"], doctor_id=U[e["doctor"]], department_id=D[e["dept"]],
                     appointment_date=day.isoformat(), slot_start=slot, slot_end=end, appointment_type="follow_up",
                     reason=f"Review: {T[e['dept']][e['tpl']][2]}"))
        if r: ap[f"fu:{e['encounter']}"] = r["id"]
    # past appointments (last 30 days) - completed / no-show / cancelled / left scheduled (data-quality case)
    pts = api.get("/patients?per_page=200")["patients"]
    docs = [(d, u) for d, us in DOCS.items() for u in us]
    for i in range(40):
        k = f"past:{i}"
        if k in ap: continue
        p = pts[(i * 7) % len(pts)]; d, u = docs[i % len(docs)]
        day = TODAY - dt.timedelta(days=1 + (i * 3) % 30)
        h = 9 + i % 8
        r = api.try_(api.post, "/opd/appointments", dict(patient_id=p["id"], doctor_id=U[u], department_id=D[d],
                     appointment_date=day.isoformat(), slot_start=f"{h:02d}:30", slot_end=f"{h:02d}:45",
                     appointment_type=rnd.choice(["new_visit", "follow_up", "consultation"]), reason="Booked by phone"))
        if not r: continue
        ap[k] = r["id"]
        # "complete" needs a check-in (which opens a visit today), so past bookings end as no-show / cancelled /
        # left scheduled - the last is a deliberate data-quality case ("past appointments never closed").
        outcome = ["no-show", "keep", "no-show", "cancel", "no-show", "keep"][i % 6]
        if outcome == "cancel": api.try_(api.put, f"/opd/appointments/{r['id']}/cancel", dict(cancel_reason="Patient travelling"))
        elif outcome == "no-show": api.try_(api.put, f"/opd/appointments/{r['id']}/no-show", {})
        elif outcome == "complete": api.try_(api.put, f"/opd/appointments/{r['id']}/complete", {})
    # upcoming new bookings (next 14 days)
    for i in range(30):
        k = f"next:{i}"
        if k in ap: continue
        p = pts[(i * 11 + 3) % len(pts)]; d, u = docs[(i * 3) % len(docs)]
        day = TODAY + dt.timedelta(days=1 + i % 14); h = 9 + i % 8
        r = api.try_(api.post, "/opd/appointments", dict(patient_id=p["id"], doctor_id=U[u], department_id=D[d],
                     appointment_date=day.isoformat(), slot_start=f"{h:02d}:15", slot_end=f"{h:02d}:30",
                     appointment_type=rnd.choice(["new_visit", "consultation", "procedure"]), reason="Online booking"))
        if r: ap[k] = r["id"]
    for i in range(40):   # repair pass for runs made before the outcome list changed
        k = f"past:{i}"
        if k in ap and i % 6 in (0, 4):
            a = api.get(f"/opd/appointments/{ap[k]}")
            if a["status"] == "scheduled": api.try_(api.put, f"/opd/appointments/{ap[k]}/no-show", {})
if __name__ == "__main__": run()
