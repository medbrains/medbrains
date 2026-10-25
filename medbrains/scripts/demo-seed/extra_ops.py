"""Extra modules, part 2: ICU, housekeeping, CSSD, infection control, quality, ambulance, BME,
home health, consents, telemedicine, chronic care, MRD, front office, comms, specialty, LMS, facilities."""
from extra_common import S, D, D0, IPD, PT, TODAY, U, X, bucket, call, day, gap, lst, save, ts

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
