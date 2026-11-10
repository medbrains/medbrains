"""Billing: IPD tariff lines (room, ICU, surgery packages), issue drafts, payments by cash/UPI/card with some partial
and outstanding, a refund, an advance, today's day-close. Insurance: insurer + TPA masters, policies, cashless
pre-auths (approved / pending / partially approved), claims."""
import random, api, state
rnd = random.Random(41)
TARIFF = {  # phone -> extra IPD lines (charge_code, description, qty, unit_price)
 "9000000060": [("ROOM-GW", "General ward bed charge (per day)", 4, 2500), ("NURS", "Nursing charges (per day)", 4, 800), ("DRV", "Consultant visit", 4, 700)],
 "9000000003": [("ROOM-GW", "General ward bed charge (per day)", 5, 2500), ("NURS", "Nursing charges (per day)", 5, 800)],
 "9000000027": [("ROOM-ICU", "ICU bed charge (per day)", 3, 12000), ("VENT", "NIV / BiPAP support (per day)", 2, 4500), ("DRV", "Consultant visit", 6, 700)],
 "9000000002": [("ROOM-CCU", "CCU bed charge (per day)", 2, 14000), ("ECHO", "2D echocardiography", 1, 2800), ("CAG", "Coronary angiography", 1, 18000)],
 "9000000033": [("ROOM-GW", "General ward bed charge (per day)", 3, 2500), ("DIAL", "Haemodialysis session", 1, 3500)],
 "9000000017": [("ROOM-GW", "General ward bed charge (per day)", 6, 2500), ("ECHO", "2D echocardiography", 1, 2800), ("DRV", "Consultant visit", 6, 700)],
 "9000000016": [("PKG-APP", "Laparoscopic appendicectomy package", 1, 55000), ("ROOM-GW", "General ward bed charge (per day)", 3, 2500)],
 "9000000039": [("PKG-HER", "Laparoscopic inguinal hernia repair (mesh) package", 1, 65000), ("ROOM-SP", "Semi-private room (per day)", 2, 4500)],
 "9000000044": [("PKG-ORIF", "ORIF distal radius with plating package", 1, 72000), ("IMPL", "Volar locking plate (implant)", 1, 18000)],
 "9000000049": [("PKG-TKR", "Total knee replacement (unilateral) package", 1, 210000), ("ROOM-PR", "Private room (per day)", 5, 6500), ("PHYS", "Physiotherapy session", 5, 600)],
 "9000000036": [("PKG-NVD", "Normal vaginal delivery package", 1, 35000), ("ROOM-SP", "Semi-private room (per day)", 2, 4500)],
 "9000000058": [("PKG-TAH", "Total abdominal hysterectomy package", 1, 85000), ("ROOM-SP", "Semi-private room (per day)", 4, 4500)],
 "9000000028": [("ROOM-PAED", "Paediatric ward bed charge (per day)", 2, 2000), ("IVF", "IV fluids and administration", 2, 900)],
 "9000000031": [("ROOM-PAED", "Paediatric ward bed charge (per day)", 4, 2000), ("PLT-TX", "Platelet transfusion (SDP)", 1, 11000)],
 "9000000053": [("ROOM-GW", "General ward bed charge (per day)", 3, 2500), ("DIAB-ED", "Diabetes educator session", 2, 500)],
 "9000000021": [("ROOM-GW", "General ward bed charge (per day)", 1, 2500)],
 "9000000041": [("PKG-TONS", "Tonsillectomy package", 1, 38000)],
 "9000000025": [("ROOM-GW", "General ward bed charge (per day)", 2, 2500), ("DRV", "Consultant visit", 2, 700)],
 "9000000012": [("ROOM-GW", "General ward bed charge (per day)", 3, 2500), ("DRS", "Wound dressing", 3, 450)],
 "9000000047": [("ROOM-GW", "General ward bed charge (per day)", 4, 2500), ("PHYS", "Physiotherapy session", 4, 600)],
}
INSURED = {  # phone -> (provider code, policy, sum insured, tpa)
 "9000000049": ("STARH", "DEMO-POL-49001", 500000, "Medi Assist (fictional)"),
 "9000000053": ("NIAC", "DEMO-POL-53002", 300000, "Health India TPA (fictional)"),
 "9000000025": ("HDFCE", "DEMO-POL-25003", 500000, "Medi Assist (fictional)"),
 "9000000041": ("STARH", "DEMO-POL-41004", 200000, None),
 "9000000017": ("NIAC", "DEMO-POL-17005", 300000, "Health India TPA (fictional)"),
 "9000000039": ("HDFCE", "DEMO-POL-39006", 400000, "Medi Assist (fictional)"),
}
PROVIDERS = [("STARH", "Star Health (demo)", "private"), ("NIAC", "New India Assurance (demo)", "public_sector"),
             ("HDFCE", "HDFC ERGO (demo)", "private"), ("MEDIA", "Medi Assist TPA (fictional)", "tpa"), ("HITPA", "Health India TPA (fictional)", "tpa")]
def invoices(pid):
    r = api.get(f"/billing/invoices?patient_id={pid}&per_page=100"); return r["invoices"] if isinstance(r, dict) else r
def run():
    api.login()
    S = state.S; P = S["patients"]; bill = state.bucket("billing")
    # 1. IPD tariff lines on the admission invoice
    for ph, lines in TARIFF.items():
        if f"ipd:{ph}" in bill or ph not in S["ipd"]: continue
        inv = [i for i in invoices(P[ph]) if i.get("admission_id") == S["ipd"][ph]["admission"] and i["status"] in ("draft", "issued")]
        if not inv: print("no ipd invoice", ph); continue
        for code, desc, q, price in lines:
            api.try_(api.post, f"/billing/invoices/{inv[0]['id']}/items", dict(charge_code=code, description=desc, source="ipd", quantity=q, unit_price=price, tax_percent=0))
        bill[f"ipd:{ph}"] = inv[0]["id"]; state.save()
    # 2. insurer masters + policies
    have = {p["code"] for p in api.get("/setup/masters/insurance-providers")}
    for c, n, t in PROVIDERS:
        if c not in have: api.try_(api.post, "/setup/masters/insurance-providers", dict(code=c, name=n, provider_type=t, contact_phone="9000090000"))
    pol = state.bucket("policies")
    for ph, (prov, num, si, tpa) in INSURED.items():
        if ph in pol: continue
        r = api.try_(api.post, f"/patients/{P[ph]}/insurance", dict(insurance_provider=dict((c, n) for c, n, _ in PROVIDERS)[prov], policy_number=num,
                     member_id=f"M-{num[-5:]}", plan_name="Family floater (demo)", valid_from="2026-04-01", valid_until="2027-03-31",
                     sum_insured=si, tpa_name=tpa, coverage_type="cashless", priority=1, is_active=True))
        if r: pol[ph] = r.get("id")
    state.save()
    # 3. pre-auths: approved, partially approved, pending (submitted), pending info
    pa = state.bucket("preauth")
    plans = {"9000000049": ("approved", 210000, 195000), "9000000041": ("approved", 38000, 38000), "9000000039": ("submitted", 65000, None),
             "9000000017": ("in_review", 45000, None), "9000000025": ("partially_approved", 12000, 8000)}
    for ph, (st, est, appr) in plans.items():
        if ph in pa or not pol.get(ph) or ph not in S["ipd"]: continue
        a = S["ipd"][ph]
        r = api.try_(api.post, "/insurance/prior-auths", dict(patient_id=P[ph], patient_insurance_id=pol[ph], service_type="inpatient",
                     service_description=TARIFF[ph][0][1], encounter_id=a["encounter"], invoice_id=bill.get(f"ipd:{ph}"),
                     urgency="urgent" if ph == "9000000017" else "standard", estimated_cost=est, requested_units=1))
        if not r: continue
        pa[ph] = dict(id=r["id"], status="draft"); api.try_(api.post, f"/insurance/prior-auths/{r['id']}/submit", {}); pa[ph]["status"] = "submitted"
        if st in ("approved", "partially_approved", "in_review"):
            body = dict(status=st)
            if appr: body.update(auth_number=f"DEMO-AUTH-{ph[-4:]}", approved_amount=appr, approved_units=1)
            if st == "partially_approved": body["notes"] = "Consumables and non-payables excluded"
            if api.try_(api.post, f"/insurance/prior-auths/{r['id']}/respond", body): pa[ph]["status"] = st
        state.save()
    # 4. issue every draft, then settle by pattern
    pts = api.get("/patients?per_page=200")["patients"]
    pay = state.bucket("payments")
    for p in pts:
        ph = p["phone"]
        for inv in invoices(p["id"]):
            iid = inv["id"]
            if iid in pay or inv["status"] in ("paid", "cancelled"): continue
            if inv["status"] == "draft":
                body = {}
                if ph in pa and pa[ph]["status"] not in ("approved",) and inv.get("admission_id"):
                    body = dict(preauth_override=True, override_reason="Interim bill raised while pre-auth decision pending")
                api.try_(api.post, f"/billing/invoices/{iid}/issue", body)
            fresh = api.get(f"/billing/invoices/{iid}")["invoice"]
            due = float(fresh["total_amount"]) - float(fresh["paid_amount"])
            if due <= 0: pay[iid] = "zero"; continue
            ipd = bool(fresh.get("admission_id"))
            adm = next((a for k, a in S["ipd"].items() if a["admission"] == fresh.get("admission_id")), None)
            roll = rnd.random()
            if ipd and ph in INSURED: plan = "insurance"
            elif ipd and adm and adm.get("discharged"): plan = "full"
            elif ipd: plan = "partial_big"
            else: plan = "full" if roll < 0.78 else "unpaid" if roll < 0.92 else "partial"
            mode = rnd.choice(["cash", "cash", "upi", "upi", "upi", "card"])
            if plan == "full": amt = due
            elif plan == "partial": amt = round(due * 0.5, 0)
            elif plan == "partial_big": amt = round(min(due * 0.4, 20000), 0); mode = rnd.choice(["upi", "card"])
            elif plan == "insurance": amt = round(min(due * 0.1, 15000), 0)   # patient co-pay / deposit; rest via claim
            else: pay[iid] = "unpaid"; continue
            if amt > 0 and api.try_(api.post, f"/billing/invoices/{iid}/payments", dict(amount=amt, mode=mode,
                     reference_number=None if mode == "cash" else f"DEMO{rnd.randint(10**8, 10**9)}", notes="Front-office counter")):
                pay[iid] = f"{plan}:{mode}:{amt}"
            state.save()
    # 5. insurance claims on insured IPD bills
    cl = state.bucket("claims")
    for ph, (prov, num, si, tpa) in INSURED.items():
        iid = bill.get(f"ipd:{ph}")
        if not iid or ph in cl: continue
        r = api.try_(api.post, "/billing/insurance-claims", dict(invoice_id=iid, patient_id=P[ph], insurance_provider=dict((c, n) for c, n, _ in PROVIDERS)[prov],
                     policy_number=num, claim_type="cashless" if ph in pa else "reimbursement", tpa_name=tpa, member_id=f"M-{num[-5:]}",
                     pre_auth_amount=next((v for k, v in [("9000000049", 195000), ("9000000041", 38000), ("9000000025", 8000)] if k == ph), None),
                     co_pay_percent=10, notes="Demo claim"))
        if r: cl[ph] = r.get("id")
    # 6. refund: doctor unavailable, OPD consult refunded
    if "refund" not in bill:
        for iid, v in pay.items():
            if v.startswith("full:cash"):
                det = api.get(f"/billing/invoices/{iid}")
                if any(it.get("source") == "opd" for it in det.get("items", [])):
                    r = api.try_(api.post, "/billing/refunds", dict(invoice_id=iid, amount=float(det["invoice"]["paid_amount"]), mode="cash",
                                 reason="Consultant called away for emergency surgery; patient chose not to wait"))
                    if r: bill["refund"] = dict(invoice=iid, amount=det["invoice"]["paid_amount"], id=r.get("id")); break
    # 7. IPD advance deposit for a patient still admitted
    if "advance" not in bill and "9000000058" in S["ipd"]:
        r = api.try_(api.post, "/billing/advances", dict(patient_id=P["9000000058"], admission_id=S["ipd"]["9000000058"]["admission"], amount=25000, payment_mode="upi", purpose="procedure",
                     reference_number="DEMOADV0001", notes="Pre-surgery deposit"))
        if r: bill["advance"] = r.get("id")
    # 8. today's day-close: expected cash comes from the system, the counted cash is short by Rs 200
    if "day_close" not in bill:
        cash = sum(float(v.split(":")[2]) for v in pay.values() if v.count(":") == 2 and v.split(":")[1] == "cash")
        refund = float(bill.get("refund", {}).get("amount", 0))
        upi = sum(float(v.split(":")[2]) for v in pay.values() if v.count(":") == 2 and v.split(":")[1] == "upi")
        card = sum(float(v.split(":")[2]) for v in pay.values() if v.count(":") == 2 and v.split(":")[1] == "card")
        r = api.try_(api.post, "/billing/day-closes", dict(close_date="2026-10-25", actual_cash=round(cash - refund - 200, 2), actual_upi=round(upi, 2),
                     actual_card=round(card, 2), shift="day", notes="Counted cash short by Rs 200; cashier to explain"))
        if r: bill["day_close"] = r.get("id")
    state.save()
    from collections import Counter; print(Counter(v.split(":")[0] for v in pay.values()), "claims", len(cl), "preauth", {k: v["status"] for k, v in pa.items()})
if __name__ == "__main__": run()
