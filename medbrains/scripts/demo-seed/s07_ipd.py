"""IPD: ~20 more admissions on the free beds, nursing + progress notes (2 Tamil, 2 Hindi), vitals, tasks,
bed transfers, discharges with summaries, two admissions stuck on discharge clearance."""
import random, api, state
rnd = random.Random(21)
NOTES_LOCAL = {  # phone -> nursing note text in the patient's language
 "9000000003": "நோயாளி இரவு நன்றாக தூங்கினார். காய்ச்சல் இல்லை. IV ஆண்டிபயாடிக் மருந்து நேரத்திற்கு கொடுக்கப்பட்டது. உணவு நன்றாக எடுத்துக்கொண்டார்.",
 "9000000027": "நோயாளிக்கு மூச்சுத் திணறல் அதிகமாக உள்ளது. SpO2 91%. மருத்துவருக்கு தகவல் தெரிவிக்கப்பட்டது. ஆக்சிஜன் 2 லிட்டர் கொடுக்கப்படுகிறது. விழும் அபாயம் அதிகம் - படுக்கை கம்பிகள் உயர்த்தப்பட்டன.",
 "9000000002": "मरीज़ को रात में सीने में हल्का दर्द हुआ, डॉक्टर को सूचित किया गया। ECG किया गया। सुबह दर्द नहीं है। पेनिसिलिन से एलर्जी - कलाई पर लाल पट्टी लगाई गई।",
 "9000000033": "मरीज़ ने आज नाश्ता कम किया। पेशाब की मात्रा कम (400 ml/12 घंटे)। करवट हर 2 घंटे में बदली जा रही है। पीठ पर दबाव घाव का खतरा - एयर मैट्रेस लगाया गया।",
}
# phone, dept, doctor, source, reason / working diagnosis, plan
CASES = [
 ("9000000060", "GEN-MEDICINE", "dr_sunil", "opd", "Community-acquired pneumonia, IV antibiotics", "discharge"),
 ("9000000003", "GEN-MEDICINE", "dr_arjun", "opd", "Enteric fever, IV ceftriaxone", "discharge"),
 ("9000000027", "GEN-MEDICINE", "dr_arjun", "er", "Acute exacerbation of COPD", "stay"),
 ("9000000002", "CARDIO", "dr_fatima", "er", "Unstable angina, rule out MI", "transfer"),
 ("9000000033", "GEN-MEDICINE", "dr_sunil", "er", "Acute kidney injury in elderly, dehydration", "stay"),
 ("9000000017", "CARDIO", "dr_fatima", "opd", "Congestive heart failure, decompensated", "pending_clearance"),
 ("9000000016", "SURG", "dr_salim", "opd", "Acute appendicitis for appendicectomy", "discharge"),
 ("9000000039", "SURG", "dr_salim", "opd", "Right inguinal hernia for elective repair", "pending_clearance"),
 ("9000000044", "ORTHO", "dr_rohan", "er", "Closed fracture distal radius, ORIF planned", "discharge"),
 ("9000000049", "ORTHO", "dr_rohan", "opd", "Osteoarthritis knee, total knee replacement", "stay"),
 ("9000000036", "OBGYN", "dr_ananya", "opd", "Term pregnancy in labour", "discharge"),
 ("9000000058", "OBGYN", "dr_ananya", "opd", "Fibroid uterus for hysterectomy", "stay"),
 ("9000000028", "PAED", "dr_kavya", "er", "Acute gastroenteritis with some dehydration", "discharge"),
 ("9000000031", "PAED", "dr_kavya", "opd", "Dengue fever with thrombocytopenia", "stay"),
 ("9000000053", "GEN-MEDICINE", "dr_arjun", "opd", "Uncontrolled type 2 diabetes, insulin initiation", "discharge"),
 ("9000000021", "GEN-MEDICINE", "dr_sunil", "direct", "Dengue fever with warning signs", "dama"),
 ("9000000041", "ENT", "dr_vivek", "opd", "Chronic tonsillitis for tonsillectomy", "discharge"),
 ("9000000025", "GEN-MEDICINE", "dr_arjun", "referral", "Hypertensive urgency", "discharge"),
 ("9000000012", "SURG", "dr_salim", "er", "Cellulitis left leg, IV antibiotics", "stay"),
 ("9000000047", "ORTHO", "dr_rohan", "er", "Low back pain with radiculopathy, traction", "discharge"),
]
EN_NOTES = ["Patient comfortable, vitals stable. IV line patent, no phlebitis. Oral intake fair.",
            "Afebrile overnight. Ambulated with assistance. Pain score 3/10 after analgesia.",
            "Dressing clean and dry. Input/output charted. Fall-risk precautions in place."]
def sign_note(enc_id, code, sections):
    n = api.try_(api.post, f"/encounters/{enc_id}/clinical-notes", dict(note_type_code=code, sections=sections))
    if n: api.try_(api.post, f"/clinical-notes/{n['id']}/sign", {})
    return n
def clean_dirty_beds():
    """Housekeeping turnaround: a discharged bed is vacant_dirty until cleaning is logged complete."""
    for w in api.get("/ipd/wards"):
        for b in api.get(f"/ipd/wards/{w['id']}/beds"):
            if b["bed_status"] == "vacant_dirty":
                t = api.try_(api.post, "/ipd/bed-turnaround", dict(bed_id=b["bed_location_id"], notes="Terminal cleaning after discharge"))
                if t: api.try_(api.post, f"/ipd/bed-turnaround/{t['id']}/complete", {})
                # product gap: completing the turnaround does not release the bed; housekeeping marks it vacant
                api.try_(api.put, f"/ipd/bed-dashboard/beds/{b['bed_location_id']}/status", dict(status="vacant_clean", reason="Cleaned after discharge"))
def run():
    api.login()
    U, D, P = state.S["users"], state.S["departments"], state.S["patients"]
    ipd = state.bucket("ipd")
    for i, (ph, d, doc, src, why, plan) in enumerate(CASES):
        if ph in ipd and ipd[ph].get("done"): continue
        if ph not in ipd:
            clean_dirty_beds()
            beds = api.get("/ipd/beds/available")
            want = "SW" if d in ("SURG", "ORTHO", "OBGYN", "ENT") else "MW"
            pool = [b for b in beds if (b["bed_number"] or "").startswith(want)] or beds
            if not pool: print("no bed for", ph); continue
            body = dict(patient_id=P[ph], department_id=D[d], doctor_id=U[doc], bed_id=pool[0]["bed_id"], admission_source=src,
                        notes=why, admission_weight_kg=round(rnd.uniform(45, 85), 1))
            if src == "referral": body.update(referral_from="Sunrise Clinic (fictional)", referral_doctor="Dr. P. Raman")
            try: r = api.post("/ipd/admissions", body)
            except api.ApiError as e: print("admit", ph, e.body[:200]); continue
            ipd[ph] = dict(admission=r["admission"]["id"], encounter=r["encounter"]["id"], bed=r["admission"]["bed_id"]); state.save()
        a = ipd[ph]; A, E = a["admission"], a["encounter"]
        # vitals chart: 3 readings
        for k in range(3):
            v = dict(encounter_id=E, temperature=round(rnd.uniform(36.6, 38.4), 1), pulse=rnd.randint(72, 108), systolic_bp=rnd.randint(108, 156),
                     diastolic_bp=rnd.randint(66, 96), respiratory_rate=rnd.randint(14, 24), spo2=rnd.randint(91, 99), notes=f"Round {k + 1}")
            api.try_(api.post, "/nurse/vitals", v)
        sign_note(E, "history_physical", [dict(code="subjective", text=why), dict(code="assessment", text=why),
                                          dict(code="plan", text="Admit, monitor vitals 4-hourly, treat as per protocol.")])
        txt = NOTES_LOCAL.get(ph, rnd.choice(EN_NOTES))
        sign_note(E, "nursing", [dict(code="observation", text=txt), dict(code="care_given", text="Medications given as charted."),
                                 dict(code="plan", text="Continue monitoring.")])
        sign_note(E, "progress", [dict(code="subjective", text="Feels better than yesterday."), dict(code="objective", text="Chest/abdomen exam as charted."),
                                  dict(code="assessment", text=why + " - improving."), dict(code="plan", text="Continue current treatment.")])
        api.try_(api.post, f"/ipd/admissions/{A}/tasks", dict(task_type="medication", description="IV antibiotic due 6-hourly", assigned_to=U["nurse_priya"]))
        api.try_(api.post, f"/ipd/admissions/{A}/tasks", dict(task_type="monitoring", description="Strict input/output chart", assigned_to=U["nurse_anita"]))
        if plan == "transfer":
            beds = [b for b in api.get("/ipd/beds/available") if b["bed_id"] != a["bed"]]
            if beds: api.try_(api.put, f"/ipd/admissions/{A}/transfer", dict(bed_id=beds[-1]["bed_id"], notes="Shifted closer to nursing station for cardiac monitoring"))
        if plan in ("discharge", "pending_clearance"):
            summ = dict(final_diagnosis=why, condition_at_discharge="Stable, afebrile, ambulant",
                        course_in_hospital=f"Admitted with {why.lower()}. Treated and improved.", treatment_given="As per drug chart.",
                        follow_up_instructions="Review in OPD after 7 days with reports.", warning_signs="Fever, breathlessness, bleeding, reduced urine output.",
                        dietary_advice="Normal diet, plenty of fluids.")
            api.try_(api.post, f"/ipd/admissions/{A}/discharge-summary", summ)
            api.try_(api.post, f"/ipd/admissions/{A}/discharge-workflow/step", dict(step="discharge_ordered", notes="Discharge advised by consultant"))
            if plan == "discharge":
                api.try_(api.post, f"/ipd/admissions/{A}/discharge-summary/finalize", {})
                if api.try_(api.put, f"/ipd/admissions/{A}/discharge", dict(discharge_type="normal", discharge_summary=summ["course_in_hospital"])):
                    a["discharged"] = True
            else:
                a["pending_clearance"] = "bill not closed"
        if plan == "dama":
            if api.try_(api.put, f"/ipd/admissions/{A}/discharge", dict(discharge_type="dama", discharge_summary="Family insisted on discharge against medical advice; risks explained and documented.")):
                a["discharged"] = "dama"
        a["plan"], a["done"] = plan, True
        state.save()
    print("ipd admissions seeded", len(ipd))
if __name__ == "__main__": run()
