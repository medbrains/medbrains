"""Extra departments (Emergency, Radiology), doctors so every clinical dept has one, nurses, and weekly OPD schedules."""
import secrets, api, state
DEPTS = [("EMERG", "Emergency Medicine", "clinical"), ("RADIO", "Radiology", "para_clinical"), ("SURG", "General Surgery", "clinical")]
DOCS = [  # username, name, dept code, specialization, fee
    ("dr_vivek", "Dr. Vivek Chandran", "ENT", "Otorhinolaryngology", 600),
    ("dr_sunil", "Dr. Sunil Bhat", "GEN-MEDICINE", "Internal Medicine", 500),
    ("dr_neha_er", "Dr. Neha Kapoor", "EMERG", "Emergency Medicine", 800),
    ("dr_rakesh", "Dr. Rakesh Iyer", "RADIO", "Radiodiagnosis", 700),
    ("dr_salim", "Dr. Salim Ahmed", "SURG", "General Surgery", 700),
]
NURSES = [("nurse_anita", "Anita Thomas", "GEN-MEDICINE"), ("nurse_kamal", "Kamalesh Rawat", "SURG"), ("nurse_jyothi", "Jyothi Reddy", "EMERG")]
def depts():
    return {d["code"]: d["id"] for d in api.get("/setup/departments")}
def run():
    api.login()
    d = depts()
    for code, name, typ in DEPTS:
        if code not in d: api.try_(api.post, "/setup/departments", dict(code=code, name=name, department_type=typ))
    d = depts(); state.S["departments"] = d
    users = {u["username"]: u["id"] for u in api.get("/setup/users")}
    for i, (u, n, dc, spec, fee) in enumerate(DOCS):
        if u not in users:
            r = api.try_(api.post, "/setup/users", dict(username=u, email=f"{u}@demo-hospital.example", password=secrets.token_urlsafe(18) + "Aa1!",
                full_name=n, role="doctor", specialization=spec, qualification="MBBS, MD (fictional)",
                medical_registration_number=f"DEMO-MCI-{9100+i}", consultation_fee=fee, department_ids=[d[dc]]))
            if r: users[u] = r["id"]
    for u, n, dc in NURSES:
        if u not in users:
            r = api.try_(api.post, "/setup/users", dict(username=u, email=f"{u}@demo-hospital.example", password=secrets.token_urlsafe(18) + "Aa1!",
                full_name=n, role="nurse", department_ids=[d[dc]]))
            if r: users[u] = r["id"]
    state.S["users"] = users
    # weekly schedules Mon-Sat for every doctor that lacks one
    have = {(s["doctor_id"], s["day_of_week"]) for s in api.get("/opd/schedules")}
    doc_dept = {"dr_arjun": "GEN-MEDICINE", "dr_kavya": "PAED", "dr_rohan": "ORTHO", "dr_fatima": "CARDIO", "dr_ananya": "OBGYN",
                **{u: dc for u, _, dc, _, _ in DOCS}}
    for u, dc in doc_dept.items():
        if u not in users: continue
        for dow in range(0, 7):
            if (users[u], dow) not in have:
                api.try_(api.post, "/opd/schedules", dict(doctor_id=users[u], department_id=d[dc], day_of_week=dow,
                         start_time="09:00:00", end_time="17:00:00", slot_duration_mins=15, max_patients=32))
    state.S["doc_dept"] = doc_dept
    state.save(); print("depts", len(d), "users", len(users))
if __name__ == "__main__": run()
