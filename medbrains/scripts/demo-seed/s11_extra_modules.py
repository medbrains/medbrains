"""Extra modules for the G2DEMO tenant: OT, diet, HR, store/indent/procurement, camps, blood bank,
ICU, housekeeping, CSSD, infection control, quality, ambulance, BME, home health.
Re-runnable: ids live in extra_state.json; each module skips what it already created.
Run:  python3 s11_extra_modules.py [module ...]"""
import datetime as dt, json, os, re, sys, traceback
import api, state

P_X = os.environ.get("MB_DEMO_EXTRA_STATE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra_state.json"))
X = json.load(open(P_X)) if os.path.exists(P_X) else {}
def save(): json.dump(X, open(P_X, "w"), indent=1, default=str)
def bucket(n): return X.setdefault(n, {})

S = state.S; PT = S["patients"]; U = S["users"]; D = S["departments"]; IPD = S["ipd"]
TODAY = dt.date.today()
D0 = TODAY.isoformat()
def day(n): return (TODAY + dt.timedelta(days=n)).isoformat()
def ts(hhmm, n=0): return f"{day(n)}T{hhmm}:00+05:30"

def gap(method, path, err):
    """Record a product gap once (keyed by method+path)."""
    g = bucket("gaps"); k = f"{method} {re.sub(r'[0-9a-f]{8}-[0-9a-f-]{27}', '{id}', path.split('?')[0])}"
    g[k] = str(err)[:400]; save(); print("  GAP", k, str(err)[:300], file=sys.stderr)

def call(method, path, body=None):
    """One API call; on failure record a gap and return None."""
    api.step_up()
    try: return api.call(method, path, body)
    except api.ApiError as e:
        gap(method, path, e); return None

def lst(path, key=None):
    r = call("GET", path)
    if r is None: return []
    if isinstance(r, dict):
        for k in ([key] if key else []) + ["data", "items", "rows", "results"]:
            if k and isinstance(r.get(k), list): return r[k]
        lists = [v for v in r.values() if isinstance(v, list)]
        return lists[0] if lists else []
    return r

def once(b, key, fn):
    """Run fn() unless bucket b already has key; store the returned id."""
    bk = bucket(b)
    if key in bk: return bk[key]
    r = fn()
    if r is None: return None
    rid = r["id"] if isinstance(r, dict) and "id" in r else r
    bk[key] = rid; save(); return rid

# ───────────────────────── 1. OT ─────────────────────────
OT_CASES = [  # phone, surgeon, procedure, code, laterality, site, priority, slot, final status
 ("9000000016", "dr_salim", "Laparoscopic appendicectomy", "0DTJ4ZZ", "right", "Right iliac fossa", "emergency", ("08:00", "09:15"), "completed"),
 ("9000000044", "dr_rohan", "ORIF distal radius with volar locking plate", "0QSH04Z", "left", "Left distal radius", "urgent", ("09:30", "11:00"), "completed"),
 ("9000000041", "dr_vivek", "Bilateral tonsillectomy", "0CTPXZZ", "bilateral", "Palatine tonsils", "elective", ("11:30", "12:30"), "completed"),
 ("9000000049", "dr_rohan", "Total knee replacement, right", "0SRC0JZ", "right", "Right knee", "elective", ("12:00", "14:30"), "in_progress"),
 ("9000000058", "dr_ananya", "Total abdominal hysterectomy", "0UT90ZZ", "midline", "Uterus (lower abdominal incision)", "elective", ("14:00", "16:00"), "confirmed"),
 ("9000000039", "dr_salim", "Open right inguinal hernia repair (Lichtenstein mesh)", "0YQ50ZZ", "right", "Right inguinal region", "elective", ("09:00", "10:30"), "requested"),
]
ROOM_OF = {"9000000016": "OT-1", "9000000044": "OT-2", "9000000041": "OT-1", "9000000049": "OT-2", "9000000058": "OT-1", "9000000039": "OT-1"}

def _checklist(bid, phase):
    rows = call("GET", f"/ot/bookings/{bid}/checklists") or []
    c = next((r for r in rows if r["phase"] == phase), None) or call("POST", f"/ot/bookings/{bid}/checklists", dict(phase=phase, items=[]))
    if not c or c.get("completed"): return
    items = [dict(i, checked=True) for i in c["items"]]
    call("PUT", f"/ot/bookings/{bid}/checklists/{c['id']}", dict(items=items, completed=True, verified_by=U["nurse_jyothi"]))

def _preop(bid):
    if not call("GET", f"/ot/bookings/{bid}/preop"):
        call("POST", f"/ot/bookings/{bid}/preop", dict(clearance_status="cleared", asa_class="asa_2", lab_results_reviewed=True, imaging_reviewed=True,
             blood_group_confirmed=False, fasting_status=True, npo_since=ts("22:00", -1), allergies_noted="No known drug allergy",
             conditions="Fit for surgery under anaesthesia"))

def _ready_for_start(bid, ph, proc):
    _preop(bid)
    h = call("GET", f"/ot/bookings/{bid}/preop-handoff") or call("PUT", f"/ot/bookings/{bid}/preop-handoff", dict(notes="Ward send-off"))
    if h and not h.get("completed"):
        call("PUT", f"/ot/bookings/{bid}/preop-handoff", dict(items=[dict(i, checked=True) for i in h["items"]],
             received_by=U["nurse_jyothi"], completed=True, notes="Patient received in OT reception"))
    cons = bucket("ot_consents")
    if ph not in cons:
        c = call("POST", "/opd/consents", dict(patient_id=PT[ph], procedure_name=proc, consent_type="surgery", ot_booking_id=bid,
                 risks_explained="Bleeding, infection, anaesthesia risks, need for re-operation explained in the patient's language.",
                 alternatives_explained="Conservative management discussed.", benefits_explained="Relief of the condition.",
                 consented_by_name="Patient (self)", witness_name="Staff Nurse Jyothi (fictional)", witness_designation="Staff nurse"))
        if c and call("PUT", f"/opd/consents/{c['id']}/sign"): cons[ph] = c["id"]; save()
    for phase in ("sign_in", "time_out"): _checklist(bid, phase)

def seed_ot():
    rooms = {r["code"]: r["id"] for r in lst("/ot/rooms")}
    for code, name, spec in (("OT-1", "Main Theatre 1 (General / Gynae / ENT)", ["general_surgery", "obgyn", "ent"]),
                             ("OT-2", "Main Theatre 2 (Orthopaedics, laminar flow)", ["orthopaedics"])):
        if code not in rooms:
            r = call("POST", "/ot/rooms", dict(code=code, name=name, specialties=spec, equipment=["anaesthesia workstation", "C-arm" if code == "OT-2" else "laparoscopy tower"]))
            if r: rooms[code] = r["id"]
    bucket("ot")["rooms"] = rooms; save()
    bk = bucket("ot_bookings")
    for ph, sur, proc, code, lat, site, prio, (s, e), final in OT_CASES:
        if ph not in bk:
            adm = IPD.get(ph, {})
            body = dict(patient_id=PT[ph], ot_room_id=rooms[ROOM_OF[ph]], primary_surgeon_id=U[sur],
                        scheduled_date=day(1) if final == "requested" else D0,
                        scheduled_start=ts(s, 1 if final == "requested" else 0), scheduled_end=ts(e, 1 if final == "requested" else 0),
                        procedure_name=proc, procedure_code=code, laterality=lat, surgical_site=site, priority=prio,
                        scrub_nurses=[U["nurse_jyothi"]], circulating_nurses=[U["nurse_kamal"]],
                        notes="Synthetic demo case")
            if not adm.get("discharged") and adm.get("admission"): body["admission_id"] = adm["admission"]
            r = call("POST", "/ot/bookings", body)
            if not r: continue
            bk[ph] = dict(id=r["id"], status="requested"); save()
        b = bk[ph]; bid = b["id"]
        if final != "requested": _preop(bid)
        order = ["requested", "confirmed", "in_progress", "completed"]
        while order.index(b["status"]) < order.index(final):
            nxt = order[order.index(b["status"]) + 1]
            if nxt == "in_progress": _ready_for_start(bid, ph, proc)
            if nxt == "completed": _checklist(bid, "sign_out")
            if not call("PUT", f"/ot/bookings/{bid}/status", dict(status=nxt)): break
            b["status"] = nxt; save()

# ───────────────────────── 2. Diet ─────────────────────────
DIETS = [  # phone, type, npo, instructions, kcal, protein
 ("9000000033", "renal", False, "Low potassium, 40 g protein, fluid restriction 1.2 L/day (AKI)", 1600, 40),
 ("9000000017", "cardiac", False, "Low sodium (<2 g/day), fluid restriction 1.5 L/day (heart failure)", 1800, 60),
 ("9000000027", "soft", False, "Soft, small frequent meals; avoid gas-forming food (COPD)", 1900, 70),
 ("9000000002", "low_sodium", False, "Low salt, low fat; no fried food (unstable angina)", 1800, 60),
 ("9000000031", "liquid", False, "Paediatric: oral fluids 2 L/day, ORS, coconut water, soft khichdi as tolerated (dengue)", 1400, 35),
 ("9000000058", "npo", True, "Nil by mouth from midnight for hysterectomy", None, None),
 ("9000000049", "diabetic", False, "1800 kcal diabetic diet, no added sugar; post-op TKR, high protein", 1800, 80),
 ("9000000012", "diabetic", False, "Diabetic diet 1600 kcal, high protein for wound healing (cellulitis)", 1600, 75),
 ("9000000039", "regular", False, "Regular diet; high fibre to avoid straining (hernia)", 2000, 60),
]
def seed_diet():
    """Deduped against the live list (not extra_state): POST /diet/orders answers 200 but the row can vanish (see gap)."""
    have = {o["patient_id"] for o in lst("/diet/orders") if o.get("status") == "active"}
    sent = []
    for ph, typ, npo, ins, kcal, prot in DIETS:
        adm = IPD.get(ph, {})
        if PT[ph] in have or adm.get("discharged"): continue
        body = dict(patient_id=PT[ph], admission_id=adm["admission"], diet_type=typ, is_npo=npo, special_instructions=ins, start_date=D0)
        if npo: body["npo_reason"] = "Pre-operative fasting"
        if kcal: body.update(calories_target=kcal, protein_g=prot)
        if call("POST", "/diet/orders", body): sent.append(ph)
    X["diet_orders"] = {o["patient_id"]: o["id"] for o in lst("/diet/orders")}; save()
    lost = [ph for ph in sent if PT[ph] not in X["diet_orders"]]
    if lost: gap("POST", "/diet/orders", f"200 OK with an id, but {len(lost)}/{len(sent)} orders are not persisted (absent from GET /diet/orders)")

# ───────────────────────── 3. HR ─────────────────────────
STAFF = [  # key (username or extra), code, first, last, dept, type, designation
 ("dr_arjun", "EMP-D001", "Arjun", "Menon", "GEN-MEDICINE", "permanent"), ("dr_sunil", "EMP-D002", "Sunil", "Varma", "GEN-MEDICINE", "permanent"),
 ("dr_kavya", "EMP-D003", "Kavya", "Reddy", "PAED", "permanent"), ("dr_rohan", "EMP-D004", "Rohan", "Kulkarni", "ORTHO", "permanent"),
 ("dr_fatima", "EMP-D005", "Fatima", "Sheikh", "CARDIO", "permanent"), ("dr_ananya", "EMP-D006", "Ananya", "Bose", "OBGYN", "permanent"),
 ("dr_vivek", "EMP-D007", "Vivek", "Sharma", "ENT", "visiting"), ("dr_salim", "EMP-D008", "Salim", "Khan", "SURG", "permanent"),
 ("dr_neha_er", "EMP-D009", "Neha", "Joshi", "EMERG", "permanent"), ("dr_rakesh", "EMP-D010", "Rakesh", "Gupta", "RADIO", "permanent"),
 ("nurse_priya", "EMP-N001", "Priya", "Thomas", "GEN-MEDICINE", "permanent"), ("nurse_anita", "EMP-N002", "Anita", "D'Souza", "PAED", "permanent"),
 ("nurse_kamal", "EMP-N003", "Kamal", "Singh", "SURG", "contract"), ("nurse_jyothi", "EMP-N004", "Jyothi", "Nair", "SURG", "permanent"),
 ("ward_meena", "EMP-S001", "Meena", "Kumari", "GEN-MEDICINE", "outsourced"), ("hk_ravi", "EMP-S002", "Ravi", "Kumar", "GEN-MEDICINE", "outsourced"),
]
SHIFTS = [("MOR", "Morning", "morning", "08:00", "14:00", False), ("EVE", "Evening", "evening", "14:00", "20:00", False),
          ("NGT", "Night", "night", "20:00", "08:00", True), ("GEN", "General (9-5)", "general", "09:00", "17:00", False)]
def seed_hr():
    emps = bucket("employees")
    have = {e["employee_code"]: e["id"] for e in lst("/hr/employees")}
    for key, code, fn, ln, dep, et in STAFF:
        if key in emps: continue
        if code in have: emps[key] = have[code]; continue
        body = dict(employee_code=code, first_name=fn, last_name=ln, department_id=D[dep], employment_type=et,
                    date_of_joining="2024-04-01", phone="98" + code[-3:].rjust(8, "0"), notes="Synthetic demo staff")
        if key in U: body["user_id"] = U[key]
        r = call("POST", "/hr/employees", body)
        if r: emps[key] = r["id"]; save()
    sh = bucket("shifts")
    have = {s["code"]: s["id"] for s in lst("/hr/shifts")}
    for code, name, typ, a, b, night in SHIFTS:
        if code not in sh:
            sh[code] = have.get(code) or (call("POST", "/hr/shifts", dict(code=code, name=name, shift_type=typ, start_time=a, end_time=b,
                                                                            break_minutes=30, is_night=night)) or {}).get("id")
            save()
    ros = bucket("rosters")
    for i in range(7):
        for j, (key, *_r) in enumerate(STAFF):
            k = f"{key}:{day(i)}"
            if k in ros or key not in emps: continue
            dep = _r[3]
            if key.startswith("dr_"): shift = "GEN"
            else: shift = ["MOR", "EVE", "NGT"][(i + j) % 3]
            if (i + j) % 7 == 6: continue   # weekly off
            r = call("POST", "/hr/rosters", dict(employee_id=emps[key], department_id=D[dep], shift_id=sh[shift], roster_date=day(i),
                                                 is_on_call=key == "dr_salim" and i == 0))
            if r: ros[k] = r["id"]; save()
    # attendance today
    att = bucket("attendance")
    late = {"nurse_kamal": ("08:25", "Late by 25 min - bus delay"), "dr_vivek": ("09:40", "Late by 40 min - OPD started late")}
    for key, *_r in STAFF:
        if key in att or key not in emps: continue
        if key == "hk_ravi":
            body = dict(employee_id=emps[key], attendance_date=D0, status="absent", notes="Absent without intimation")
        else:
            shift = "GEN" if key.startswith("dr_") else "MOR"
            cin = late.get(key, ("08:55" if shift == "GEN" else "07:52", None))
            body = dict(employee_id=emps[key], attendance_date=D0, shift_id=sh[shift], check_in=ts(cin[0]), status="present",
                        source="biometric", notes=cin[1])
        r = call("POST", "/hr/attendance", body)
        if r: att[key] = r["id"]; save()
    lv = bucket("leaves")
    if "ward_meena" not in lv:
        r = call("POST", "/hr/leaves", dict(employee_id=emps["ward_meena"], leave_type="casual", start_date=day(3), end_date=day(4), days=2,
                                            reason="Family function in native village"))
        if r:
            lv["ward_meena"] = r["id"]; save()
            call("PUT", f"/hr/leaves/{r['id']}/action", dict(action="approve", remarks="Approved - cover arranged"))
    if "nurse_anita" not in lv:
        r = call("POST", "/hr/leaves", dict(employee_id=emps["nurse_anita"], leave_type="medical", start_date=day(1), end_date=day(2), days=2,
                                            reason="Viral fever, medical certificate attached"))
        if r: lv["nurse_anita"] = r["id"]; save()

# ───────────────────────── 4. Store / indent / procurement ─────────────────────────
ITEMS = [  # code, name, category, unit, price, reorder, opening stock
 ("SC-GLV-75", "Sterile surgical gloves 7.5", "surgical_consumables", "pair", 28, 200, 1200),
 ("SC-GLV-EXM", "Examination gloves (nitrile, M)", "surgical_consumables", "box of 100", 420, 20, 80),
 ("SC-SYR-5", "Disposable syringe 5 ml", "consumables", "piece", 4.5, 500, 3000),
 ("SC-SYR-10", "Disposable syringe 10 ml", "consumables", "piece", 6, 300, 1500),
 ("SC-IVSET", "IV infusion set (adult)", "consumables", "piece", 18, 200, 600),
 ("SC-IVCAN-20", "IV cannula 20G", "consumables", "piece", 22, 200, 450),
 ("SC-MASK-3P", "Surgical mask 3-ply", "ppe", "piece", 2.5, 1000, 5000),
 ("SC-MASK-N95", "N95 respirator", "ppe", "piece", 45, 100, 150),
]
def seed_store():
    cat = bucket("store_items")
    have = {c["code"]: c["id"] for c in lst("/indent/catalog")}
    for code, name, c, unit, price, rl, stock in ITEMS:
        if code in cat: continue
        iid = have.get(code) or (call("POST", "/indent/catalog", dict(code=code, name=name, category=c, unit=unit, base_price=price,
                                                                        reorder_level=rl, domain="consumable")) or {}).get("id")
        if not iid: continue
        cat[code] = iid; save()
        once("store_receipts", code, lambda: call("POST", "/indent/stock/movements", dict(catalog_item_id=iid, movement_type="receipt",
             quantity=stock, reference_type="opening_stock", notes="Opening stock (demo)")))
    ind = bucket("indents")
    def mk(key, dep, typ, prio, lines, notes):
        if key in ind: return ind[key]
        r = call("POST", "/indent/requisitions", dict(department_id=D[dep], indent_type=typ, priority=prio, notes=notes,
                 items=[dict(catalog_item_id=cat[c], item_name=n, quantity_requested=q) for c, n, q in lines]))
        if not r: return None
        rid = (r.get("requisition") or r)["id"]; ind[key] = dict(id=rid, stage="draft"); save(); return ind[key]
    a = mk("surg_ward", "SURG", "surgical", "urgent", [("SC-GLV-75", "Sterile surgical gloves 7.5", 100), ("SC-IVSET", "IV infusion set (adult)", 40),
           ("SC-SYR-5", "Disposable syringe 5 ml", 200)], "Surgical ward weekly top-up (post-op patients)")
    b = mk("med_ward", "GEN-MEDICINE", "general", "normal", [("SC-MASK-3P", "Surgical mask 3-ply", 500), ("SC-GLV-EXM", "Examination gloves (nitrile, M)", 10),
           ("SC-SYR-10", "Disposable syringe 10 ml", 150), ("SC-IVCAN-20", "IV cannula 20G", 60)], "Medical ward weekly indent")
    c = mk("er_n95", "EMERG", "emergency", "emergency", [("SC-MASK-N95", "N95 respirator", 50)], "ER - suspected TB cases, N95 needed")
    for rec, upto in ((a, "issued"), (b, "submitted"), (c, "approved")):
        if not rec: continue
        rid = rec["id"]
        if rec["stage"] == "draft" and call("PUT", f"/indent/requisitions/{rid}/submit"): rec["stage"] = "submitted"; save()
        if upto in ("approved", "issued") and rec["stage"] == "submitted":
            det = call("GET", f"/indent/requisitions/{rid}")
            items = det.get("items", []) if det else []
            if call("PUT", f"/indent/requisitions/{rid}/approve", dict(items=[dict(item_id=i["id"], quantity_approved=i["quantity_requested"]) for i in items],
                    notes="Approved by store in-charge")): rec["stage"] = "approved"; save()
        if upto == "issued" and rec["stage"] == "approved":
            det = call("GET", f"/indent/requisitions/{rid}")
            items = det.get("items", []) if det else []
            if call("PUT", f"/indent/requisitions/{rid}/issue", dict(items=[dict(item_id=i["id"], quantity_issued=i.get("quantity_approved") or i["quantity_requested"]) for i in items],
                    notes="Issued to surgical ward")): rec["stage"] = "issued"; save()
    # procurement
    pr = bucket("procurement")
    if "vendor" not in pr:
        v = next((v for v in lst("/procurement/vendors") if v.get("code") == "VEN-DEMO-01"), None) or call("POST", "/procurement/vendors", dict(
            code="VEN-DEMO-01", name="Demo Surgicals Pvt Ltd (fictional)", vendor_type="distributor", contact_person="Mr. K. Demo",
            phone="9800000101", email="orders@demo-surgicals.example", city="Demo Nagar", state="Karnataka", pincode="560001", country="India",
            gst_number="29ABCDE1234F1Z5", payment_terms="Net 30", credit_days=30, supply_categories=["consumables", "ppe"], notes="Synthetic vendor"))
        if v: pr["vendor"] = v["id"]; save()
    if "store" not in pr:
        sl = next((x for x in lst("/procurement/store-locations") if x.get("code") == "CS-MAIN"), None) or call("POST", "/procurement/store-locations",
             dict(code="CS-MAIN", name="Central Store (Main)", location_type="central"))
        if sl: pr["store"] = sl["id"]; save()
    if "po" not in pr and pr.get("vendor"):
        po = call("POST", "/procurement/purchase-orders", dict(vendor_id=pr["vendor"], store_location_id=pr.get("store"), expected_delivery=day(5),
             payment_terms="Net 30", notes="Replenish N95 and masks below reorder level", items=[
             dict(catalog_item_id=cat.get("SC-MASK-N95"), item_name="N95 respirator", item_code="SC-MASK-N95", unit="piece", quantity_ordered=500, unit_price=42, tax_percent=5),
             dict(catalog_item_id=cat.get("SC-GLV-75"), item_name="Sterile surgical gloves 7.5", item_code="SC-GLV-75", unit="pair", quantity_ordered=2000, unit_price=26, tax_percent=12)]))
        if po:
            pid = (po.get("purchase_order") or po)["id"]; pr["po"] = pid; save()
    # ponytail: PO stays draft - maker-checker refuses self-approval by demo_admin (correct rule, not a gap).

# ───────────────────────── 5. Camps ─────────────────────────
CAMP_PEOPLE = [  # phone or None, name, age, gender, rbs, bp, hba1c, diagnosis, referred
 ("9000000005", "Gurpreet Singh", 52, "male", 238, (148, 92), 8.4, "Uncontrolled type 2 diabetes with hypertension", True),
 ("9000000008", "Jignesh Parmar", 61, "male", 182, (138, 86), 7.1, "Type 2 diabetes, fair control", False),
 ("9000000019", "Manjunath Gowda", 49, "male", 112, (124, 80), 5.6, "Normal screening", False),
 ("9000000022", "Imran Qureshi", 39, "male", 154, (130, 84), 6.2, "Pre-diabetes (impaired glucose)", False),
 ("9000000053", "Venkatesh Iyer", 60, "male", 210, (136, 88), 7.9, "Known diabetic on insulin - review", True),
 (None, "Lakshmamma (walk-in, fictional)", 58, "female", 265, (156, 96), 9.2, "Newly detected type 2 diabetes", True),
 (None, "Ramaiah (walk-in, fictional)", 66, "male", 128, (142, 90), 5.9, "Stage 1 hypertension, normoglycaemic", False),
]
def _camp_ready(cid, cp):
    """Clear the activation gates: team, supply plan, remote readiness checklist."""
    if not cp.get("team"):
        for key, role in (("dr_arjun", "lead_doctor"), ("nurse_priya", "nurse"), ("ward_meena", "registration")):
            call("POST", f"/camp/camps/{cid}/team", dict(employee_id=X["employees"][key], role_in_camp=role, is_confirmed=True))
        cp["team"] = True; save()
    if not cp.get("supplies"):
        for name, cat_, unit, qty in (("Glucometer strips", "consumable", "strip", 300), ("Metformin 500 mg (sample strips)", "medicine", "strip", 50)):
            call("POST", f"/camp/camps/{cid}/supplies", dict(category=cat_, item_name=name, unit=unit, planned_qty=qty, packed_qty=qty, charge_mode="free",
                 **(dict(batch_no="MET-DEMO-2611", expiry_date=day(400)) if cat_ == "medicine" else {})))
        cp["supplies"] = True; save()
    if not cp.get("remote"):
        call("PUT", f"/camp/camps/{cid}/remote-setup", dict(village_name="Demo Nagar", district_name="Demo District", expected_footfall=150,
             site_contact_name="Ward councillor (fictional)", site_contact_phone="9800000202", referral_facility_name="MedBrains Demo Hospital",
             referral_facility_phone="9800000100", ambulance_contact_name="108", ambulance_contact_phone="108", power_plan="Hall mains + UPS",
             network_plan="4G hotspot", water_sanitation_plan="Hall toilets", privacy_plan="Screened examination corner",
             crowd_control_plan="Token system", bmw_plan="Colour-coded bins, sharps container", infection_control_plan="Hand rub at every desk", status="ready"))
        ops = call("GET", f"/camp/camps/{cid}/remote-operations") or {}
        for it in ops.get("checklist", []):
            if it.get("status") != "ok": call("PUT", f"/camp/remote-checklist/{it['id']}", dict(status="ok", notes="Checked on site"))
        cp["remote"] = True; save()
    ops = call("GET", f"/camp/camps/{cid}/remote-operations") or {}
    for it in ops.get("supplies", []):
        if it["category"] == "medicine" and not it.get("batch_no") and float(it.get("packed_qty") or 0) > 0:
            # ponytail: batch/expiry cannot be edited after creation (UpdateSupplyItemRequest lacks them) - unpack and re-add.
            call("PUT", f"/camp/supplies/{it['id']}", dict(packed_qty=0, shortage_notes="Re-entered with batch and expiry"))
            call("POST", f"/camp/camps/{cid}/supplies", dict(category="medicine", item_name=it["item_name"], unit=it.get("unit"), planned_qty=50,
                 packed_qty=50, charge_mode="free", batch_no="MET-DEMO-2611", expiry_date=day(400)))

def seed_camp():
    cp = bucket("camp")
    if "camp" not in cp:
        c = next((c for c in lst("/camp/camps") if c.get("name", "").startswith("Diabetes screening camp, Demo Nagar")), None) or call("POST", "/camp/camps", dict(
            name="Diabetes screening camp, Demo Nagar", camp_type="specialized", organizing_department_id=D["GEN-MEDICINE"],
            coordinator_id=X["employees"]["dr_arjun"], scheduled_date=D0, start_time="08:00", end_time="13:00",
            venue_name="Demo Nagar Community Hall (fictional)", venue_address="1st Cross, Demo Nagar", venue_city="Demo City",
            venue_state="Karnataka", venue_pincode="560001", expected_participants=150, budget_allocated=25000,
            logistics_notes="Glucometers x4, BP apparatus x3, HbA1c analyser", is_free=True))
        if not c: return
        cp["camp"] = c["id"]; save()
    cid = cp["camp"]
    if not cp.get("approved") and call("PUT", f"/camp/camps/{cid}/approve"): cp["approved"] = True; save()
    if cp.get("approved") and not cp.get("active"): _camp_ready(cid, cp)
    if cp.get("approved") and not cp.get("active") and call("PUT", f"/camp/camps/{cid}/activate"): cp["active"] = True; save()
    regs = bucket("camp_regs")
    for ph, name, age, g, rbs, (sy, di), a1c, dx, ref in CAMP_PEOPLE:
        k = ph or name
        if k not in regs:
            body = dict(camp_id=cid, person_name=name, age=age, gender=g, phone=ph or None, chief_complaint="Diabetes screening",
                        is_walk_in=ph is None, attending_doctor_id=U["dr_arjun"], clinical_department_id=D["GEN-MEDICINE"])
            if ph: body["patient_id"] = PT[ph]
            r = call("POST", "/camp/registrations", body)
            if not r: continue
            regs[k] = dict(id=r["id"]); save()
        rg = regs[k]
        if "screening" not in rg:
            r = call("POST", "/camp/screenings", dict(registration_id=rg["id"], bp_systolic=sy, bp_diastolic=di, blood_sugar_random=rbs,
                     test_hba1c=a1c, mh_diabetes=a1c >= 6.5 and ph in ("9000000005", "9000000008", "9000000053"), mh_hypertension=sy >= 140,
                     diagnosis=dx, findings=f"RBS {rbs} mg/dL, HbA1c {a1c}%", advice="Diet, exercise, review in OPD" if ref else "Annual screening",
                     referred_to_hospital=ref, referral_department="General Medicine" if ref else None, referral_urgency="routine" if ref else None))
            if r: rg["screening"] = r["id"]; save()
        if ref and "followup" not in rg:
            r = call("POST", "/camp/followups", dict(registration_id=rg["id"], followup_date=day(7), followup_type="opd_visit",
                     notes="Review with fasting/PP sugar and HbA1c in General Medicine OPD"))
            if r: rg["followup"] = r["id"]; save()

# ───────────────────────── 6. Blood bank ─────────────────────────
DONORS = [  # num, first, last, group, dob, gender, comps
 ("DNR-0001", "Arvind", "Demo", "a_positive", "1990-02-11", "male", ["platelets", "prbc", "ffp"]),
 ("DNR-0002", "Sneha", "Demo", "a_positive", "1994-07-23", "female", ["platelets", "prbc"]),
 ("DNR-0003", "Karan", "Demo", "o_positive", "1988-11-05", "male", ["prbc", "ffp"]),
 ("DNR-0004", "Pooja", "Demo", "b_positive", "1996-03-17", "female", ["prbc"]),
 ("DNR-0005", "Mohit", "Demo", "o_negative", "1985-09-30", "male", ["prbc", "ffp"]),
 ("DNR-0006", "Divya", "Demo", "b_negative", "1992-12-01", "female", ["prbc"]),
]
SHELF = {"platelets": 5, "prbc": 42, "ffp": 365}
VOL = {"platelets": 50, "prbc": 280, "ffp": 200}
def seed_blood():
    dn = bucket("bb_donors")
    have = {d["donor_number"]: d["id"] for d in lst("/blood-bank/donors")}
    for num, fn, ln, grp, dob, g, comps in DONORS:
        rec = dn.get(num)
        if not rec:
            did = have.get(num) or (call("POST", "/blood-bank/donors", dict(donor_number=num, first_name=fn, last_name=ln, blood_group=grp,
                  date_of_birth=dob, gender=g, phone="97" + num[-4:].rjust(8, "0"), address="Demo Nagar (fictional)", id_type="voter_id",
                  id_number="DEMO" + num[-4:])) or {}).get("id")
            if not did: continue
            rec = dn[num] = dict(id=did); save()
        if "donation" not in rec:
            d = call("POST", f"/blood-bank/donors/{rec['id']}/donations", dict(bag_number=f"BAG-{num[-4:]}", donation_type="whole_blood", volume_ml=450,
                     camp_name=None, weight_kg=62, hemoglobin_g_dl=13.8, systolic_bp=122, diastolic_bp=78, pulse=76, temperature_c=36.8,
                     notes="Voluntary donation"))
            if not d: continue
            rec["donation"] = d["id"]; save()
        if "tti" not in rec:
            if call("POST", f"/blood-bank/donations/{rec['donation']}/tti", dict(results=[dict(marker=m, result="non_reactive", method="ELISA", kit_lot="LOT-DEMO-1")
                    for m in ("hiv", "hbsag", "hcv", "syphilis", "malaria")])): rec["tti"] = True; save()
        cm = rec.setdefault("components", {})
        for ct in comps:
            if ct in cm: continue
            c = call("POST", "/blood-bank/components", dict(donation_id=rec["donation"], component_type=ct, bag_number=f"BAG-{num[-4:]}-{ct.upper()}",
                     blood_group=grp, volume_ml=VOL[ct], expiry_at=f"{day(SHELF[ct])}T08:00:00Z", storage_location="Platelet agitator" if ct == "platelets" else "Blood bank fridge 1"))
            if not c: continue
            cm[ct] = c["id"]; save()
            call("PUT", f"/blood-bank/components/{c['id']}/status", dict(status="available"))
    # crossmatch + issue + transfusion of platelets for dengue patient 9000000031 (A+)
    xm = bucket("bb_issue")
    ph = "9000000031"
    unit = dn.get("DNR-0001", {}).get("components", {}).get("platelets")
    if not unit: return
    if "crossmatch" not in xm:
        r = call("POST", "/blood-bank/crossmatch", dict(patient_id=PT[ph], blood_group="a_positive", component_type="platelets", units_requested=1,
                 clinical_indication="Dengue with platelet count 18,000/uL and mucosal bleeding"))
        if not r: return
        xm["crossmatch"] = r["id"]; save()
    if not xm.get("compatible") and call("PUT", f"/blood-bank/crossmatch/{xm['crossmatch']}", dict(status="compatible", result="Compatible (ABO/Rh identical)", component_id=unit)):
        xm["compatible"] = True; save()
    if xm.get("compatible") and not xm.get("issued"):
        if call("PUT", f"/blood-bank/components/{unit}/status", dict(status="issued")): xm["issued"] = True; save()
    if xm.get("issued") and "transfusion" not in xm:
        r = call("POST", "/blood-bank/transfusions", dict(patient_id=PT[ph], component_id=unit, crossmatch_id=xm["crossmatch"],
                 patient_verified_by=U["nurse_anita"], product_verified_by=U["nurse_priya"]))
        if r: xm["transfusion"] = r["id"]; save()
    # a second request pending (hysterectomy, B-negative, PRBC on standby)
    if "standby" not in xm:
        r = call("POST", "/blood-bank/crossmatch", dict(patient_id=PT["9000000058"], blood_group="b_negative", component_type="prbc", units_requested=2,
                 clinical_indication="Group and save for total abdominal hysterectomy"))
        if r: xm["standby"] = r["id"]; save()

# ───────────────────────── 7a. ICU ─────────────────────────
ICU = {  # phone -> flowsheet, scores, devices. ponytail: no news2/qsofa - they 500 (Rust IcuScoreType lacks them, gap)
 "9000000027": (dict(heart_rate=104, systolic_bp=138, diastolic_bp=84, respiratory_rate=26, spo2=90, temperature=37.6, intake_ml=1400, output_ml=900, urine_ml=850,
                     notes="On NIV BiPAP 14/6, FiO2 35%. Accessory muscle use reduced."),
                [("apache_ii", 14, "Predicted mortality ~15%"), ("gcs", 15, "Alert")], [("peripheral_iv", "Left forearm 20G")]),
 "9000000033": (dict(heart_rate=96, systolic_bp=104, diastolic_bp=62, respiratory_rate=20, spo2=96, temperature=38.4, intake_ml=2200, output_ml=650, urine_ml=600,
                     notes="Oliguric. Febrile since evening; catheter urine sent for culture."),
                [("sofa", 6, "Renal 3, cardiovascular 1, CNS 1, coagulation 1"), ("rass", -1, "Drowsy, sustained awakening to voice")],
                [("urinary_catheter", "Foley 16Fr, inserted on admission for strict I/O"), ("central_line", "Right IJV triple lumen")]),
}
def seed_icu():
    ic = bucket("icu")
    for ph, (fs, scores, devs) in ICU.items():
        adm = IPD[ph]["admission"]; r = ic.setdefault(ph, {})
        if "flowsheet" not in r:
            x = call("POST", f"/icu/admissions/{adm}/flowsheets", fs)
            if x: r["flowsheet"] = x["id"]; save()
        for typ, val, note in scores:
            if typ in r: continue
            x = call("POST", f"/icu/admissions/{adm}/scores", dict(score_type=typ, score_value=val, notes=note))
            if x: r[typ] = x["id"]; save()
        for typ, site in devs:
            if typ in r: continue
            x = call("POST", f"/icu/admissions/{adm}/devices", dict(device_type=typ, site=site))
            if x: r[typ] = x["id"]; save()

# ───────────────────────── 7b. Housekeeping ─────────────────────────
HK = [("ward", "SURG", "Terminal cleaning after discharge - bed of appendicectomy patient", "verified"),
      ("ot", "SURG", "OT-1 between-case cleaning", "completed"), ("icu", "GEN-MEDICINE", "High-touch surface disinfection (ICU)", "in_progress"),
      ("er", "EMERG", "Blood spill clean-up, ER bay 3 (RTA case)", "completed"), ("washroom", "GEN-MEDICINE", "Ward washroom 2-hourly cleaning", "pending"),
      ("corridor", "PAED", "Paediatric corridor mopping", "assigned")]
def seed_housekeeping():
    hk = bucket("housekeeping")
    flow = ["pending", "assigned", "in_progress", "completed"]
    for i, (area, dep, note, final) in enumerate(HK):
        k = f"{area}:{i}"
        if k not in hk:
            r = call("POST", "/housekeeping/tasks", dict(department_id=D[dep], area_type=area, task_date=D0, notes=note,
                     assigned_to=None if final == "pending" else "Ravi Kumar (housekeeping)" if i % 2 else "Meena Kumari"))
            if not r: continue
            hk[k] = dict(id=r["id"], status=r.get("status", "pending")); save()
        t = hk[k]
        tgt = "completed" if final == "verified" else final
        while t["status"] in flow and flow.index(t["status"]) < flow.index(tgt):
            nxt = flow[flow.index(t["status"]) + 1]
            if not call("PUT", f"/housekeeping/tasks/{t['id']}/status", dict(status=nxt)): break
            t["status"] = nxt; save()
        if final == "verified" and t["status"] == "completed" and call("PUT", f"/housekeeping/tasks/{t['id']}/verify"):
            t["status"] = "verified"; save()

# ───────────────────────── 7c. CSSD ─────────────────────────
INSTR = [("CSSD-I-001", "Mayo scissors 6.5in", "cutting"), ("CSSD-I-002", "Kelly artery forceps", "clamping"), ("CSSD-I-003", "Needle holder 7in", "suturing"),
         ("CSSD-I-004", "Langenbeck retractor", "retracting"), ("CSSD-I-005", "BP handle No.3", "cutting")]
def seed_cssd():
    cs = bucket("cssd")
    ins = cs.setdefault("instruments", {})
    have = {i["barcode"]: i["id"] for i in lst("/cssd/instruments")}
    for bc, name, cat_ in INSTR:
        if bc not in ins:
            iid = have.get(bc) or (call("POST", "/cssd/instruments", dict(barcode=bc, name=name, category=cat_, manufacturer="Demo Surgical Works", max_uses=500)) or {}).get("id")
            if iid: ins[bc] = iid; save()
    if "set" not in cs and ins:
        r = call("POST", "/cssd/sets", dict(set_code="SET-MINOR-01", set_name="Minor surgery set", department="General Surgery",
                 description="Appendicectomy / hernia basic set", items=[dict(instrument_id=v, quantity=2) for v in ins.values()]))
        if r: cs["set"] = r["id"]; save()
    if "sterilizer" not in cs:
        r = call("POST", "/cssd/sterilizers", dict(name="Autoclave 1 (steam)", model="DemoClave 300", serial_number="AC-DEMO-0001", method="steam",
                 chamber_size_liters=300, location="CSSD sterile zone"))
        if r: cs["sterilizer"] = r["id"]; save()
    loads = cs.setdefault("loads", {})
    for key, final in (("L1", "completed"), ("L2", "running")):
        if key not in loads:
            r = call("POST", "/cssd/loads", dict(sterilizer_id=cs["sterilizer"], method="steam", notes=f"Steam cycle 134C - batch {key}"))
            if not r: continue
            loads[key] = dict(id=r["id"], status="loading"); save()
        ld = loads[key]; lid = ld["id"]
        if "item" not in ld and cs.get("set"):
            r = call("POST", f"/cssd/loads/{lid}/items", dict(set_id=cs["set"], quantity=3, pack_expiry_date=day(30)))
            if r: ld["item"] = r["id"]; save()
        if ld["status"] == "loading" and call("PUT", f"/cssd/loads/{lid}/status", dict(status="running")): ld["status"] = "running"; save()
        if final == "completed" and ld["status"] == "running":
            if "indicators" not in ld:
                ok = [call("POST", f"/cssd/loads/{lid}/indicators", dict(indicator_type=t, indicator_brand="DemoIndic", indicator_lot="IND-26-10", result_pass=True,
                       notes="Bowie-Dick / BI incubated 24h - pass")) for t in ("chemical", "biological")]
                if all(ok): ld["indicators"] = True; save()
            if call("PUT", f"/cssd/loads/{lid}/status", dict(status="completed", cycle_time_minutes=45, temperature_c=134, pressure_psi=30.5)):
                ld["status"] = "completed"; save()
        if final == "completed" and ld["status"] == "completed" and "issuance" not in ld and ld.get("item"):
            r = call("POST", "/cssd/issuances", dict(load_item_id=ld["item"], issued_to_department="Operation Theatre",
                     issued_to_patient_id=PT["9000000039"], notes="For hernia repair (OT-1, tomorrow)"))
            if r and any(i["id"] == r["id"] for i in lst("/cssd/issuances")): ld["issuance"] = r["id"]; save()
            elif r: gap("POST", "/cssd/issuances", "200 OK with an id, but the issuance is not persisted (absent from GET /cssd/issuances)")

# ───────────────────────── 7d. Infection control ─────────────────────────
def seed_infection():
    ic = bucket("infection")
    if "cauti" not in ic:
        r = call("POST", "/infection-control/surveillance", dict(patient_id=PT["9000000033"], hai_type="cauti", organism="Escherichia coli (ESBL) - pending sensitivity",
                 device_type="urinary_catheter", insertion_date=day(-3), infection_date=D0, department_id=D["GEN-MEDICINE"],
                 nhsn_criteria="Catheter >2 days, fever >38C, urine culture >=1e5 CFU/mL", notes="Synthetic demo HAI event"))
        if r: ic["cauti"] = r["id"]; save()
    for dep, obs, comp, staff, find in (("SURG", 40, 33, "nurses", "Missed moment 1 before patient contact in 5 observations"),
                                        ("GEN-MEDICINE", 30, 21, "doctors", "Low compliance after touching patient surroundings"),
                                        ("PAED", 25, 23, "nurses", "Good compliance")):
        if dep in ic: continue
        r = call("POST", "/infection-control/hygiene-audits", dict(audit_date=D0, department_id=D[dep], observations=obs, compliant=comp,
                 non_compliant=obs - comp, staff_category=staff, findings=find,
                 moment_breakdown={"before_patient": obs // 5, "before_aseptic": obs // 5, "after_body_fluid": obs // 5, "after_patient": obs // 5, "after_surroundings": obs - 4 * (obs // 5)}))
        if r: ic[dep] = r["id"]; save()

# ───────────────────────── 7e. Quality incidents ─────────────────────────
INCIDENTS = [
 ("near_miss_lasa", "Near miss: LASA drug picked (Losartan instead of Lorazepam)", "medication_error", "near_miss", "GEN-MEDICINE", "9000000027",
  "Pharmacy picked look-alike/sound-alike drug; staff nurse caught it at the 5-rights check before administration.", "Drug returned, LASA shelf separation requested"),
 ("fall_033", "Patient fall from bed - no injury", "patient_fall", "minor", "GEN-MEDICINE", "9000000033",
  "Elderly patient found on floor beside bed at 05:30; bed rails were down after sponging.", "Doctor reviewed, no injury; fall-risk band and bed alarm applied"),
 ("needle_er", "Sharps left on ER trolley", "occupational_safety", "minor", "EMERG", None,
  "Used suture needle found on dressing trolley after RTA wound toilet.", "Sharps disposed; staff re-briefed on point-of-use disposal"),
]
def seed_quality():
    q = bucket("quality")
    for key, title, typ, sev, dep, ph, desc, act in INCIDENTS:
        if key in q: continue
        body = dict(title=title, description=desc, incident_type=typ, severity=sev, department_id=D[dep], location=f"{dep} ward", incident_date=D0,
                    immediate_action=act, is_anonymous=False)
        if ph: body["patient_id"] = PT[ph]
        r = call("POST", "/quality/incidents", body)
        if r: q[key] = r["id"]; save()

# ───────────────────────── 7f. Ambulance ─────────────────────────
def seed_ambulance():
    am = bucket("ambulance")
    fleet = {a["vehicle_number"]: a["id"] for a in lst("/ambulance/fleet")}
    for num, typ, vent in (("KA-01-AM-1081", "als", True), ("KA-01-AM-1082", "bls", False)):
        if num not in am:
            aid = fleet.get(num) or (call("POST", "/ambulance/fleet", dict(vehicle_number=num, ambulance_type=typ, make="Force", model="Traveller",
                  year_of_manufacture=2023, has_ventilator=vent, has_defibrillator=typ == "als", has_oxygen=True, seating_capacity=4, fuel_type="diesel",
                  fitness_certificate_expiry=day(300), insurance_expiry=day(200), notes="Synthetic demo vehicle")) or {}).get("id")
            if aid: am[num] = aid; save()
    if "driver" not in am:
        r = call("POST", "/ambulance/drivers", dict(employee_id=X["employees"]["hk_ravi"], license_number="KA01-DEMO-2019-0001", license_type="HMV",
                 license_expiry=day(900), bls_certified=True, bls_expiry=day(365), phone="9800000303"))
        if r: am["driver"] = r["id"]; save()
    if "trip_rta" not in am:
        er = S["er"]["9000000037"]
        r = call("POST", "/ambulance/trips", dict(trip_type="emergency", priority="critical", ambulance_id=am.get("KA-01-AM-1081"),
                 driver_id=X["employees"]["hk_ravi"], patient_id=PT["9000000037"], patient_name="Farhan (RTA)", pickup_address="Demo Circle, Ring Road (fictional)",
                 pickup_landmark="Near Demo petrol bunk", drop_address="MedBrains Demo Hospital - Emergency", er_visit_id=er["visit"], is_billable=False))
        if r: am["trip_rta"] = dict(id=r["id"], status="requested"); save()
    t = am.get("trip_rta")
    flow = ["requested", "dispatched", "en_route_pickup", "at_pickup", "en_route_drop", "at_drop", "completed"]
    while t and flow.index(t["status"]) < len(flow) - 1:
        nxt = flow[flow.index(t["status"]) + 1]
        if not call("PUT", f"/ambulance/trips/{t['id']}/status", dict(status=nxt)): break
        t["status"] = nxt; save()
    if "trip_discharge" not in am:
        r = call("POST", "/ambulance/trips", dict(trip_type="discharge", priority="routine", ambulance_id=am.get("KA-01-AM-1082"),
                 patient_id=PT["9000000025"], patient_name="Vinod Nair", pickup_address="MedBrains Demo Hospital", drop_address="12, 3rd Main, Demo Nagar (fictional)", is_billable=True))
        if r: am["trip_discharge"] = dict(id=r["id"], status="requested"); save()

# ───────────────────────── 7g. BME ─────────────────────────
BME = [("BME-VENT-01", "ICU ventilator", "Hamilton (demo)", "C3", "life_support", "critical", True, "GEN-MEDICINE", "ICU bed 2"),
       ("BME-DEF-01", "Defibrillator / monitor", "Philips (demo)", "HeartStart", "resuscitation", "critical", True, "EMERG", "ER resus bay"),
       ("BME-MON-01", "Multipara patient monitor", "Mindray (demo)", "uMEC12", "monitoring", "high", True, "GEN-MEDICINE", "ICU bed 1"),
       ("BME-INF-01", "Infusion pump", "B. Braun (demo)", "Infusomat", "infusion", "high", False, "PAED", "Paeds ward"),
       ("BME-XR-01", "Digital X-ray 500 mA", "Allengers (demo)", "MARS 50", "imaging", "medium", False, "RADIO", "X-ray room 1"),
       ("BME-ESU-01", "Electrosurgical unit", "Valleylab (demo)", "FT10", "surgical", "high", True, "SURG", "OT-1"),
       ("BME-AUTO-01", "Steam autoclave 300 L", "DemoClave", "300", "sterilization", "medium", False, "SURG", "CSSD")]
def seed_bme():
    bm = bucket("bme")
    have = {e.get("asset_tag"): e["id"] for e in lst("/bme/equipment")}
    for tag, name, make, model, cat_, risk, crit, dep, loc in BME:
        if tag in bm: continue
        eid = have.get(tag) or (call("POST", "/bme/equipment", dict(name=name, make=make, model=model, serial_number=tag.replace("BME", "SN"), asset_tag=tag,
              category=cat_, risk_category=risk, is_critical=crit, department_id=D[dep], location_description=loc, status="active",
              purchase_date="2024-03-15", purchase_cost=250000, installation_date="2024-04-01", expected_life_years=10,
              warranty_start_date="2024-04-01", warranty_end_date="2027-03-31", vendor_id=X.get("procurement", {}).get("vendor"))) or {}).get("id")
        if eid: bm[tag] = eid; save()
    if "breakdown" not in bm and "BME-INF-01" in bm:
        r = call("POST", "/bme/breakdowns", dict(equipment_id=bm["BME-INF-01"], department_id=D["PAED"], priority="high",
                 description="Occlusion alarm triggering repeatedly with no occlusion", downtime_start=ts("07:30"), vendor_visit_required=False))
        if r: bm["breakdown"] = r["id"]; save()
    if "wo" not in bm and bm.get("breakdown"):
        r = call("POST", "/bme/work-orders", dict(equipment_id=bm["BME-INF-01"], order_type="corrective", priority="high", scheduled_date=D0,
                 description="Check pressure sensor, recalibrate", breakdown_id=bm["breakdown"]))
        if r: bm["wo"] = r["id"]; save()
    if "pm_wo" not in bm and "BME-VENT-01" in bm:
        r = call("POST", "/bme/work-orders", dict(equipment_id=bm["BME-VENT-01"], order_type="preventive", priority="medium", scheduled_date=day(3),
                 description="Quarterly PM: flow sensor, O2 cell, alarms"))
        if r: bm["pm_wo"] = r["id"]; save()

# ───────────────────────── 7h. Home health ─────────────────────────
def seed_home():
    hh = bucket("home_visits")
    for ph, date, time, purpose in (("9000000053", D0, "16:00", "Insulin injection technique and glucometer teaching after discharge"),
                                     ("9000000025", day(1), "10:30", "Post-discharge BP check and medication reconciliation (elderly, hypertensive urgency)"),
                                     ("9000000016", day(2), "11:00", "Wound check and suture removal planning after appendicectomy")):
        if ph in hh: continue
        r = call("POST", "/home-health/visits", dict(patient_id=PT[ph], nurse_id=U["nurse_priya"], scheduled_date=date, scheduled_time=time,
                 address="Demo Nagar (fictional address)", purpose=purpose, visit_order=len(hh) + 1))
        if r: hh[ph] = r["id"]; save()

# ═════════════════════ Extension: remaining sidebar modules ═════════════════════
def opd_enc(ph, dept=None):
    pid = PT[ph]
    return next((v["encounter"] for v in S["opd"].values() if v["patient"] == pid and (dept is None or v["dept"] == dept)), None)

def seed_consents():
    """Surgical consents for the two OT cases not yet started (058 signed + linked, 039 pending signature)."""
    cons = bucket("ot_consents"); bk = X.get("ot_bookings", {})
    for ph, proc, sign in (("9000000058", "Total abdominal hysterectomy", True), ("9000000039", "Open right inguinal hernia repair (Lichtenstein mesh)", False)):
        if ph in cons or ph not in bk: continue
        c = call("POST", "/opd/consents", dict(patient_id=PT[ph], encounter_id=IPD[ph]["encounter"], procedure_name=proc, consent_type="surgery",
                 ot_booking_id=bk[ph]["id"], risks_explained="Bleeding, infection, injury to adjacent organs, anaesthesia risks explained.",
                 alternatives_explained="Medical / watchful management discussed.", benefits_explained="Definitive treatment.",
                 consented_by_name="Patient (self)", witness_name="Staff Nurse Priya (fictional)", witness_designation="Staff nurse"))
        if not c: continue
        if sign: call("PUT", f"/opd/consents/{c['id']}/sign")
        cons[ph] = c["id"]; save()

def seed_tele():
    tm = bucket("tele")
    for key, ph, doc, at, final, note in (("f025", "9000000025", "dr_arjun", ts("17:00"), "completed", "BP 138/86 at home, no headache. Continue amlodipine 5 mg."),
                                          ("f005", "9000000005", "dr_arjun", ts("11:00", 2), "scheduled", None),
                                          ("f031", "9000000031", "dr_kavya", ts("10:00", 3), "scheduled", None)):
        if key not in tm:
            r = call("POST", "/telemedicine/consultations", dict(patient_id=PT[ph], doctor_id=U[doc], scheduled_at=at, provider="jitsi"))
            if not r: continue
            tm[key] = dict(id=r["id"], status=r.get("status", "scheduled")); save()
        t = tm[key]; flow = ["scheduled", "waiting", "in_progress", "completed"]
        while t["status"] in flow and flow.index(t["status"]) < flow.index(final):
            nxt = flow[flow.index(t["status"]) + 1]
            if not call("PUT", f"/telemedicine/consultations/{t['id']}/status", dict(status=nxt, doctor_notes=note if nxt == "completed" else None)): break
            t["status"] = nxt; save()

def seed_chronic():
    cc = bucket("chronic")
    progs = cc.setdefault("programs", {})
    have = {p["code"]: p["id"] for p in lst("/chronic-care/programs")}
    for code, name, typ in (("CC-DM", "Diabetes care programme", "diabetes"), ("CC-HTN", "Hypertension control programme", "hypertension"),
                            ("CC-COPD", "COPD care programme", "copd")):
        if code not in progs:
            pid = have.get(code) or (call("POST", "/chronic-care/programs", dict(code=code, name=name, program_type=typ, default_duration_months=12,
                  description=f"{name} (demo)")) or {}).get("id")
            if pid: progs[code] = pid; save()
    en = cc.setdefault("enrollments", {})
    for ph, code, doc, icd in (("9000000053", "CC-DM", "dr_arjun", "E11.9"), ("9000000005", "CC-DM", "dr_arjun", "E11.65"),
                               ("9000000025", "CC-HTN", "dr_arjun", "I10"), ("9000000027", "CC-COPD", "dr_arjun", "J44.1")):
        k = f"{ph}:{code}"
        if k in en or code not in progs: continue
        r = call("POST", "/chronic-care/enrollments", dict(patient_id=PT[ph], program_id=progs[code], primary_doctor_id=U[doc], enrollment_date=D0,
                 expected_end_date=day(365), icd_code=icd, notes="Enrolled from demo seed"))
        if r: en[k] = r["id"]; save()

def seed_mrd():
    md = bucket("mrd")
    for ph, vol, shelf in (("9000000016", 1, "IPD-R1-S2"), ("9000000044", 1, "IPD-R1-S3"), ("9000000060", 1, "IPD-R1-S4"), ("9000000003", 1, "IPD-R1-S5")):
        if ph in md: continue
        rid = (call("POST", "/mrd/records", dict(patient_id=PT[ph], record_type="ipd", volume_number=vol, total_pages=42, shelf_location=shelf,
               filing_method="terminal_digit", retention_years=10, notes="Discharged IPD file")) or {}).get("id")
        if rid: md[ph] = dict(id=rid); save()
    for ph, to, purpose in (("9000000016", ("user", "dr_salim"), "Surgical audit - appendicectomy outcomes"),
                            ("9000000060", ("dept", "GEN-MEDICINE"), "Death/discharge review committee - pneumonia case")):
        r = md.get(ph)
        if not r or r.get("issued"): continue
        body = dict(purpose=purpose, due_days=3, notes="Requested via MRD desk")
        if to[0] == "user": body["issued_to_user_id"] = U[to[1]]
        else: body["issued_to_department_id"] = D[to[1]]
        if call("POST", f"/mrd/records/{r['id']}/issue", body): r["issued"] = True; save()

def seed_front_office():
    fo = bucket("visitors")
    for ph, name, rel, bed in (("9000000049", "Sunita Bhosale (fictional)", "spouse", "Ortho ward"), ("9000000031", "Ravi Chauhan (fictional)", "father", "Paeds ward"),
                               ("9000000033", "Amit Tiwari (fictional)", "son", "Medical ward"), ("9000000058", "Abdul Rahman (fictional)", "husband", "Gynae ward")):
        if ph in fo and fo[ph].get("pass"): continue
        rec = fo.setdefault(ph, {})
        if "visitor" not in rec:
            r = call("POST", "/front-office/visitors", dict(visitor_name=name, phone="98100" + ph[-5:], id_type="aadhaar_masked", id_number="XXXX-XXXX-" + ph[-4:],
                     relationship=rel, category="general", patient_id=PT[ph], purpose="Attendant visit"))
            if not r: continue
            rec["visitor"] = r["id"]; save()
        r = call("POST", "/front-office/passes", dict(registration_id=rec["visitor"], bed_number=bed, valid_hours=12))
        if r: rec["pass"] = r["id"]; save()
        if r and ph in ("9000000049", "9000000031") and call("POST", f"/front-office/visitor-logs/{r['id']}/check-in"): rec["checked_in"] = True; save()

def seed_comms():
    cm = bucket("comms")
    if "tv" not in cm:
        r = call("POST", "/tv/announcements", dict(message="Staff notice: Fire drill today at 15:00 in Block A. Please follow your ward evacuation plan.",
                 priority="info", ends_at=ts("16:00")))
        if r: cm["tv"] = r["id"]; save()
    for key, uname in (("msg_priya", "nurse_priya"), ("msg_jyothi", "nurse_jyothi")):
        if key in cm: continue
        r = call("POST", "/communications/messages", dict(channel="push", recipient_type="staff", recipient_id=U[uname], recipient_name=uname,
                 recipient_contact=uname, subject="Fire drill 15:00", body="Fire drill today at 15:00 in Block A. Ward in-charges to complete headcount."))
        if r: cm[key] = r["id"]; save()

def seed_maternity():
    mt = bucket("maternity")
    ph = "9000000036"
    if "reg" not in mt:
        r = call("POST", "/specialty/maternity/registrations", dict(patient_id=PT[ph], registration_number="ANC-DEMO-0001", lmp_date=day(-276), edd_date=day(4),
                 gravida=2, para=1, abortion=0, living=1, risk_category="low", blood_group="o_positive"))
        if not r: return
        mt["reg"] = r["id"]; save()
    for n, wk, wt, bp, fh, fhr, hb, nxt in ((1, 12, 54.0, (110, 70), None, None, 11.2, -168), (2, 28, 60.5, (114, 72), 28, 146, 10.8, -56),
                                             (3, 36, 64.0, (118, 76), 35, 142, 11.0, -14), (4, 39, 65.2, (120, 78), 37, 138, 11.4, 4)):
        k = f"anc{n}"
        if k in mt: continue
        r = call("POST", f"/specialty/maternity/registrations/{mt['reg']}/anc", dict(visit_number=n, gestational_weeks=wk, weight_kg=wt, bp_systolic=bp[0],
                 bp_diastolic=bp[1], fundal_height_cm=fh, fetal_heart_rate=fhr, hemoglobin=hb, urine_protein="nil", urine_sugar="nil", oedema="none",
                 ultrasound_done=n in (1, 3), pcpndt_form_f_filed=n in (1, 3), pcpndt_form_f_number=f"FF-DEMO-{n:03d}" if n in (1, 3) else None,
                 next_visit_date=day(nxt + 7) if n < 4 else None, notes="Recorded today from ANC card (dates on card)"))
        if r: mt[k] = r["id"]; save()

def seed_dental_ophtho():
    sp = bucket("specialty")
    for ph, cc, dx, plan in (("9000000040", "Pain in lower right back tooth for 5 days", "Irreversible pulpitis 46", "Root canal treatment 46, then crown"),
                             ("9000000046", "Bleeding gums while brushing", "Chronic generalised gingivitis", "Oral prophylaxis (scaling), review 3 months")):
        k = f"dental:{ph}"
        if k in sp: continue
        r = call("POST", "/specialty/dental/exams", dict(patient_id=PT[ph], encounter_id=opd_enc(ph), chief_complaint=cc, diagnosis=dx, treatment_plan=plan))
        if r: sp[k] = r["id"]; save()
    for ph, body in (("9000000053", dict(visual_acuity_od="6/9", visual_acuity_os="6/12", bcva_od="6/6", bcva_os="6/9", iop_od="16", iop_os="17",
                                          fundus="Few dot-blot haemorrhages and microaneurysms both eyes, no CSME", diagnosis="Mild non-proliferative diabetic retinopathy OU",
                                          plan="Strict glycaemic control, review 6 months", review_after_months=6, lens_type="none")),
                     ("9000000013", dict(visual_acuity_od="6/18", visual_acuity_os="6/12", sphere_od="-1.25", sphere_os="-0.75", cylinder_od="-0.50", axis_od=180,
                                          bcva_od="6/6", bcva_os="6/6", iop_od="14", iop_os="15", diagnosis="Myopia with astigmatism OD", plan="Spectacles prescribed",
                                          lens_type="single_vision", lens_advice="Anti-reflective coating", review_after_months=12))):
        k = f"ophtho:{ph}"
        if k in sp: continue
        r = call("POST", "/specialty/ophthalmology/exams", dict(patient_id=PT[ph], encounter_id=opd_enc(ph), **body))
        if r: sp[k] = r["id"]; save()

QI = [  # code, name, category, unit, freq, target, values [(dept, num, den, note)]
 ("NABH-HH", "Hand hygiene compliance rate", "infection_control", "%", "monthly", 90,
  [("SURG", 33, 40, "From hand-hygiene audit"), ("GEN-MEDICINE", 21, 30, "From hand-hygiene audit"), ("PAED", 23, 25, "From hand-hygiene audit")]),
 ("NABH-FALL", "Patient falls per 1000 patient-days", "patient_safety", "per 1000", "monthly", 1, [("GEN-MEDICINE", 1, 120, "1 fall (no injury)")]),
 ("NABH-NM", "Medication near-miss reporting count", "medication_safety", "count", "monthly", None, [("GEN-MEDICINE", 1, None, "LASA near miss")]),
 ("NABH-CAUTI", "CAUTI rate per 1000 catheter-days", "infection_control", "per 1000", "monthly", 2, [("GEN-MEDICINE", 1, 85, "1 CAUTI")]),
]
def seed_quality_indicators():
    qi = bucket("quality_indicators")
    have = {i["code"]: i["id"] for i in lst("/quality/indicators")}
    first = TODAY.replace(day=1).isoformat()
    for code, name, cat_, unit, freq, tgt, vals in QI:
        rec = qi.setdefault(code, {})
        if "id" not in rec:
            body = dict(code=code, name=name, category=cat_, unit=unit, frequency=freq, auto_calculated=False)
            if tgt is not None: body["target_value"] = tgt
            iid = have.get(code) or (call("POST", "/quality/indicators", body) or {}).get("id")
            if not iid: continue
            rec["id"] = iid; save()
        for dep, num, den, note in vals:
            if dep in rec: continue
            v = dict(indicator_id=rec["id"], period_start=first, period_end=D0, numerator_value=num, department_id=D[dep], notes=note)
            if den: v.update(denominator_value=den, calculated_value=round(num * (100 if unit == "%" else 1000) / den, 2))
            else: v["calculated_value"] = num
            r = call("POST", "/quality/indicator-values", v)
            if r: rec[dep] = r["id"]; save()

def seed_lms():
    lm = bucket("lms")
    if "course" not in lm:
        c = next((c for c in lst("/lms/courses") if c.get("code") == "LMS-HH-01"), None) or call("POST", "/lms/courses", dict(
            code="LMS-HH-01", title="Hand hygiene - WHO 5 moments", description="Mandatory NABH infection-control module for all clinical staff",
            category="infection_control", duration_hours=1, is_mandatory=True))
        if not c: return
        lm["course"] = c["id"]; save()
    if "module" not in lm:
        m = call("POST", f"/lms/courses/{lm['course']}/modules", dict(title="The 5 moments", sort_order=1,
                 content={"text": "Before patient contact, before aseptic task, after body-fluid exposure, after patient contact, after touching surroundings."}))
        if m: lm["module"] = m["id"]; save()
    en = lm.setdefault("enrollments", {})
    for u in ("nurse_priya", "nurse_anita", "nurse_kamal", "nurse_jyothi", "dr_sunil"):
        if u in en: continue
        r = call("POST", "/lms/enrollments", dict(user_id=U[u], course_id=lm["course"], due_date=day(14)))
        if r: en[u] = r["id"]; save()

def seed_facilities():
    fa = bucket("facilities")
    for key, cat_, dep, prio, desc in (("ac_leak", "hvac", "SURG", "high", "AC water leak above bed 4, surgical ward - ceiling tile soaked"),
                                       ("light_er", "electrical", "EMERG", "medium", "Tube light flickering in ER bay 3")):
        if key in fa: continue
        r = call("POST", "/facilities/work-orders", dict(category=cat_, department_id=D[dep], priority=prio, description=desc, notes="Raised by ward in-charge"))
        if r: fa[key] = r["id"]; save()

# ───────────────────────── Linkage verification (GET only) ─────────────────────────
def verify():
    res = []
    def chk(name, ok, detail=""): res.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name, detail)
    bk = X.get("ot_bookings", {})
    for ph, b in bk.items():
        r = call("GET", f"/ot/bookings/{b['id']}") or {}
        adm = IPD.get(ph, {})
        exp_adm = None if adm.get("discharged") else adm.get("admission")
        chk(f"OT {ph} patient+admission", r.get("patient_id") == PT[ph] and r.get("admission_id") == exp_adm, f"status={r.get('status')}")
        if exp_adm:
            l = call("GET", f"/ot/bookings?admission_id={exp_adm}") or {}
            chk(f"OT {ph} listed under admission", any(x["id"] == b["id"] for x in l.get("bookings", [])))
        c = call("GET", f"/ot/bookings/{b['id']}/consents") or {}
        if ph in X.get("ot_consents", {}) and ph != "9000000039":
            chk(f"OT {ph} surgical consent linked", c.get("surgical_consent_id") == X["ot_consents"][ph])
    diets = {o["id"]: o for o in lst("/diet/orders")}
    for ph, *_ in DIETS:
        if IPD[ph].get("discharged"): continue
        o = next((d for d in diets.values() if d["patient_id"] == PT[ph]), {})
        chk(f"Diet {ph}", o.get("patient_id") == PT[ph] and o.get("admission_id") == IPD[ph]["admission"], o.get("diet_type"))
    xm = X.get("bb_issue", {})
    tr = next((t for t in lst("/blood-bank/transfusions") if t["id"] == xm.get("transfusion")), {})
    chk("Blood transfusion -> 9000000031 + platelet unit + crossmatch", tr.get("patient_id") == PT["9000000031"] and tr.get("crossmatch_id") == xm.get("crossmatch")
        and tr.get("component_id") == X["bb_donors"]["DNR-0001"]["components"]["platelets"])
    cms = lst("/blood-bank/crossmatch")
    c1 = next((c for c in cms if c["id"] == xm.get("crossmatch")), {})
    chk("Crossmatch 031 compatible", c1.get("patient_id") == PT["9000000031"] and c1.get("status") in ("compatible", "issued"), c1.get("status"))
    regs = {r["id"]: r for r in lst(f"/camp/registrations?camp_id={X['camp']['camp']}")}
    for k, rg in X.get("camp_regs", {}).items():
        r = regs.get(rg["id"], {})
        chk(f"Camp reg {k}", r.get("camp_id") == X["camp"]["camp"] and (r.get("patient_id") == PT[k] if k in PT else r.get("patient_id") is None))
    for ph in ICU:
        f = call("GET", f"/icu/admissions/{IPD[ph]['admission']}/flowsheets") or []
        d = call("GET", f"/icu/admissions/{IPD[ph]['admission']}/devices") or []
        chk(f"ICU {ph} flowsheet+devices under admission", len(f) >= 1 and len(d) >= 1, f"{len(f)} flowsheets, {len(d)} devices")
    sv = next((e for e in lst("/infection-control/surveillance") if e["id"] == X["infection"]["cauti"]), {})
    chk("HAI CAUTI -> 9000000033", sv.get("patient_id") == PT["9000000033"], sv.get("hai_type"))
    inc = {i["id"]: i for i in lst("/quality/incidents")}
    for k, ph in (("near_miss_lasa", "9000000027"), ("fall_033", "9000000033")):
        chk(f"Incident {k} -> {ph}", inc.get(X["quality"][k], {}).get("patient_id") == PT[ph], inc.get(X["quality"][k], {}).get("severity"))
    t = call("GET", f"/ambulance/trips/{X['ambulance']['trip_rta']['id']}") or {}
    chk("Ambulance RTA trip -> 9000000037 + ER visit", t.get("patient_id") == PT["9000000037"] and t.get("er_visit_id") == S["er"]["9000000037"]["visit"], t.get("status"))
    hv = {v["id"]: v for v in lst("/home-health/visits")}
    for ph, vid in X.get("home_visits", {}).items(): chk(f"Home visit {ph}", hv.get(vid, {}).get("patient_id") == PT[ph])
    emps = {e["id"]: e for e in lst("/hr/employees")}
    chk("HR employees linked to users", all(emps.get(eid, {}).get("user_id") == U[k] for k, eid in X["employees"].items() if k in U))
    cat = {c["id"]: c for c in lst("/indent/catalog")}
    g = cat.get(X["store_items"]["SC-GLV-75"], {})
    chk("Store stock: gloves 7.5 = 1200 receipt - 100 issued", float(g.get("current_stock", -1)) == 1100, f"current_stock={g.get('current_stock')}")
    mt = call("GET", f"/specialty/maternity/registrations/{X['maternity']['reg']}") or {}
    chk("Maternity reg -> 9000000036", mt.get("patient_id") == PT["9000000036"] or (mt.get("registration") or {}).get("patient_id") == PT["9000000036"])
    X["verify"] = [dict(name=n, ok=o, detail=d) for n, o, d in res]; save()
    print(f"{sum(o for _, o, _ in res)}/{len(res)} linkage checks passed")

MODULES = {"ot": seed_ot, "diet": seed_diet, "hr": seed_hr, "store": seed_store, "camp": seed_camp, "blood": seed_blood, "icu": seed_icu, "housekeeping": seed_housekeeping, "cssd": seed_cssd,
           "infection": seed_infection, "quality": seed_quality, "ambulance": seed_ambulance, "bme": seed_bme, "home": seed_home,
           "consents": seed_consents, "tele": seed_tele, "chronic": seed_chronic, "mrd": seed_mrd, "front_office": seed_front_office,
           "comms": seed_comms, "maternity": seed_maternity, "dental_ophtho": seed_dental_ophtho, "quality_indicators": seed_quality_indicators,
           "lms": seed_lms, "facilities": seed_facilities}

def run(names=()):
    """Entry point for run_all.py: every module, then the GET-only linkage check."""
    api.login()
    X["gaps"] = {}
    for name in (names or MODULES):
        print("==", name)
        try: MODULES[name]()
        except Exception:
            traceback.print_exc(); gap("SCRIPT", name, traceback.format_exc(limit=1))
    save()
    if not names: verify()

def main():
    if sys.argv[1:] == ["--verify"]:
        api.login(); return verify()
    run(tuple(sys.argv[1:]))

if __name__ == "__main__":
    main()
