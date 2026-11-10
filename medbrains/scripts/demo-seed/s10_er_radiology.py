"""Emergency visits (incl. a road-traffic MLC with injuries + police intimation) and radiology orders/reports."""
import random, api, state
rnd = random.Random(51)
ER = [  # phone, arrival, complaint, triage, vitals, mlc, outcome
 ("9000000037", "ambulance", "Road traffic accident - two-wheeler skid, head and left arm injury", "emergent",
  dict(pulse_rate=112, blood_pressure_systolic=102, blood_pressure_diastolic=64, spo2=95, respiratory_rate=22, gcs_score=14, pain_score=8), True, "observation"),
 ("9000000043", "walk_in", "Central chest pain radiating to left arm for 1 hour", "immediate",
  dict(pulse_rate=104, blood_pressure_systolic=162, blood_pressure_diastolic=98, spo2=94, respiratory_rate=20, gcs_score=15, pain_score=7), False, "discharged"),
 ("9000000057", "private_vehicle", "Wheeze and breathlessness since night (known asthmatic child)", "urgent",
  dict(pulse_rate=132, blood_pressure_systolic=98, blood_pressure_diastolic=60, spo2=91, respiratory_rate=34, gcs_score=15, pain_score=2), False, "discharged"),
 ("9000000035", "walk_in", "Cut injury right palm from kitchen knife", "less_urgent",
  dict(pulse_rate=88, blood_pressure_systolic=126, blood_pressure_diastolic=82, spo2=99, respiratory_rate=16, gcs_score=15, pain_score=5), False, "discharged"),
 ("9000000051", "walk_in", "High fever with chills and vomiting for 2 days", "urgent",
  dict(pulse_rate=116, blood_pressure_systolic=100, blood_pressure_diastolic=62, spo2=97, respiratory_rate=22, gcs_score=15, pain_score=3), False, "in_treatment"),
]
RAD = [  # source (opd uhid-dept key fragment or ipd phone), exam code, indication, final status, findings, impression, critical
 ("ipd:9000000060", "XR-CHEST-PA", "Fever, cough, crepitations right base", "verified", "Homogeneous opacity right lower zone with air bronchogram.", "Right lower lobe pneumonia.", False),
 ("ipd:9000000027", "CT-CHEST-HR", "COPD exacerbation, rule out bronchiectasis", "reported", "Centrilobular emphysema both upper lobes. No bronchiectasis.", "Emphysema; no acute consolidation.", False),
 ("ipd:9000000016", "US-ABD", "Right iliac fossa pain", "verified", "Non-compressible tubular structure 9 mm in RIF with periappendiceal fluid.", "Acute appendicitis.", False),
 ("ipd:9000000049", "MR-KNEE", "Pre-operative assessment", "verified", "Severe medial compartment joint space loss with osteophytes.", "Grade IV osteoarthritis right knee.", False),
 ("ipd:9000000047", "MR-LSSPINE", "Low back pain with left leg radiation", "completed", None, None, False),
 ("ipd:9000000017", "XR-CHEST-PA", "Breathlessness, pedal oedema", "verified", "Cardiomegaly (CTR 0.62), bilateral pleural effusion, upper lobe diversion.", "Features of congestive cardiac failure.", False),
 ("ipd:9000000031", "US-ABD", "Dengue, abdominal pain", "reported", "Gall bladder wall oedema, mild ascites, right pleural effusion.", "Features of plasma leakage - correlate with dengue.", False),
 ("ipd:9000000002", "XR-CHEST-PA", "Chest pain", "verified", "Normal cardiac silhouette. Lungs clear.", "No acute cardiopulmonary abnormality.", False),
 ("er:9000000037", "CT-BRAIN", "Head injury after RTA, GCS 14", "reported", "6 mm acute subdural haematoma along left frontoparietal convexity, no midline shift.", "Acute left SDH - urgent neurosurgical opinion.", True),
 ("er:9000000037", "XR-ELBOW", "Swelling left elbow after fall", "verified", "Undisplaced fracture of the radial head.", "Undisplaced radial head fracture.", False),
 ("ipd:9000000039", "US-SOFT", "Groin swelling", "scheduled", None, None, False),
 ("ipd:9000000012", "US-DOP-LL-VEN", "Left leg cellulitis, rule out DVT", "ordered", None, None, False),
 ("ipd:9000000053", "US-ABD", "Fatty liver screening in diabetes", "in_progress", None, None, False),
]
def add_mlc(ph, vid, P, U, er):
    m = api.try_(api.post, "/emergency/mlc", dict(er_visit_id=vid, patient_id=P[ph], case_type="road_traffic_accident",
                 police_station="Demo Nagar Police Station (fictional)", brought_by="108 ambulance", informant_name="Passer-by (name withheld)",
                 history_of_incident="Two-wheeler skidded on wet road near Demo Circle; patient not wearing helmet.",
                 examination_findings="Conscious, GCS 14. Laceration over left temporal region, swelling left elbow.",
                 examining_doctor_id=U["dr_neha_er"], place_of_incident="Demo Circle, Ring Road (fictional)",
                 condition_on_arrival="Conscious, drowsy, bleeding from scalp wound", treatment_given="Wound toilet, suturing, IV fluids, analgesia"))
    if not m:   # creating the ER visit with is_mlc=true already opened the MLC case
        m = next((c for c in api.get("/emergency/mlc") if c["er_visit_id"] == vid), None)
    if m:
        er[ph]["mlc"] = m["id"]
        api.try_(api.post, f"/emergency/mlc/{m['id']}/injuries", dict(body_site="Left temporal scalp", body_site_laterality="left", injury_type="laceration",
                 length_cm=4.5, width_cm=0.8, depth_cm=0.5, description="Lacerated wound, bone not exposed", probable_age="Fresh (< 6 h)", probable_weapon="Hard blunt surface (road)", nature="simple"))
        api.try_(api.post, f"/emergency/mlc/{m['id']}/injuries", dict(body_site="Left elbow", body_site_laterality="left", injury_type="fracture",
                 description="Radial head fracture on X-ray", probable_age="Fresh", nature="grievous"))
        api.try_(api.post, f"/emergency/mlc/{m['id']}/police-intimations", dict(police_station="Demo Nagar Police Station (fictional)", officer_name="SI R. Demo",
                 officer_designation="Sub-Inspector", sent_via="phone", notes="Intimated at arrival; DD entry awaited"))
def run():
    api.login()
    S = state.S; P = S["patients"]; U = S["users"]
    er = state.bucket("er")
    for ph, arr, cc, lvl, v, mlc, outcome in ER:
        if ph in er and (not mlc or er[ph].get("mlc")): continue
        if ph in er: vid = er[ph]["visit"]; add_mlc(ph, vid, P, U, er); continue
        try: r = api.post("/emergency/visits", dict(patient_id=P[ph], arrival_mode=arr, chief_complaint=cc, is_mlc=mlc, vitals=v))
        except api.ApiError as e: print("er", ph, e.body[:200]); continue
        vid = r["id"]; er[ph] = dict(visit=vid, encounter=r.get("encounter_id")); state.save()
        api.try_(api.post, f"/emergency/visits/{vid}/triage", dict(triage_level=lvl, triage_system="ESI", chief_complaint=cc, **v))
        if mlc: add_mlc(ph, vid, P, U, er)
        api.try_(api.post, f"/emergency/visits/{vid}/observation-notes", dict(note="Vitals monitored every 15 minutes; patient responding to treatment."))
        if outcome == "discharged":
            api.try_(api.post, f"/emergency/visits/{vid}/discharge-summary", dict(final_diagnosis=cc, condition_at_discharge="Stable",
                     clinical_course="Treated in ER and improved.", follow_up_instructions="Review in OPD in 3 days."))
            api.try_(api.post, f"/emergency/visits/{vid}/discharge-summary/finalize", {})
        er[ph]["outcome"] = outcome
        api.try_(api.put, f"/emergency/visits/{vid}", dict(status=outcome, disposition=outcome if outcome == "discharged" else None,
                 disposition_notes=f"ER outcome: {outcome}", attending_doctor_id=U["dr_neha_er"]))
        state.save()
    # radiology
    exams = {e["code"]: e for e in api.get("/radiology/exams")}
    rad = state.bucket("radiology")
    for i, (src, code, ind, final, find, imp, crit) in enumerate(RAD):
        k = f"{src}:{code}"
        if k in rad: continue
        kind, ph = src.split(":")
        enc = S["ipd"].get(ph, {}).get("encounter") if kind == "ipd" else S["er"].get(ph, {}).get("encounter")
        ex = exams[code]
        body = dict(patient_id=P[ph], modality_id=ex["modality_id"], exam_id=ex["id"], body_part=ex.get("body_part"), clinical_indication=ind,
                    priority="stat" if crit else "routine", pregnancy_checked=True, patient_pregnant=False, contrast_required=False)
        if enc: body["encounter_id"] = enc
        r = api.try_(api.post, "/radiology/orders", body)
        if not r: continue
        oid = r["id"]; rad[k] = dict(order=oid, status="ordered")
        for st in ("scheduled", "in_progress", "completed"):
            if ["ordered", "scheduled", "in_progress", "completed", "reported", "verified"].index(final) < ["ordered", "scheduled", "in_progress", "completed"].index(st): break
            if api.try_(api.put, f"/radiology/orders/{oid}/status", dict(status=st)): rad[k]["status"] = st
        if final in ("reported", "verified") and find:
            rep = api.try_(api.post, f"/radiology/orders/{oid}/report", dict(findings=find, impression=imp, is_critical=crit,
                           recommendations="Clinical correlation advised." if not crit else "Critical finding phoned to ER consultant."))
            if rep:
                rad[k]["status"] = "reported"; rad[k]["report"] = rep.get("id")
                if final == "verified" and api.try_(api.put, f"/radiology/reports/{rep['id']}/verify", {}): rad[k]["status"] = "verified"
        state.save()
    from collections import Counter; print("er", {k: v.get("outcome") for k, v in er.items()}, Counter(v["status"] for v in rad.values()))
if __name__ == "__main__": run()
