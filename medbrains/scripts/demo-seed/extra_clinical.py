"""Extra modules, part 1: OT, diet, HR, store/indent/procurement, camp, blood bank."""
from extra_common import D, D0, IPD, PT, U, X, bucket, call, day, gap, lst, once, save, ts


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

