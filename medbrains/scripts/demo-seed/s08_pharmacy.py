"""Pharmacy: dispense OPD prescriptions (bill paid first), OTC sales, NDPS receipts + a witnessed morphine
dispense on an IPD patient, and a patient return."""
import random, re, api, state
rnd = random.Random(31)
PER_DAY = {"OD": 1, "BD": 2, "TDS": 3, "QID": 4, "HS": 1, "SOS": 1}
def qty(freq, dur):
    n = int(re.search(r"\d+", dur).group()) if re.search(r"\d+", dur) else 3
    return max(1, min(PER_DAY.get(freq, 2) * n, 60))
def pharmacy_invoice(pid, enc):
    inv = api.get(f"/billing/invoices?patient_id={pid}&per_page=50")
    rows = inv.get("invoices", inv) if isinstance(inv, dict) else inv
    return [i for i in rows if i.get("encounter_id") == enc]
def pay_open(pid, enc, source_hint, mode):
    """Issue + settle the patient's open invoice(s) for this encounter that the pharmacy order raised."""
    for i in pharmacy_invoice(pid, enc):
        if i["status"] in ("paid", "cancelled"): continue
        items = api.get(f"/billing/invoices/{i['id']}").get("items", [])
        if not any(it.get("source") == source_hint for it in items): continue
        if i["status"] == "draft": api.try_(api.post, f"/billing/invoices/{i['id']}/issue", {})
        due = float(i["total_amount"]) - float(i["paid_amount"])
        if due > 0: api.try_(api.post, f"/billing/invoices/{i['id']}/payments", dict(amount=round(due, 2), mode=mode, reference_number=f"DEMO{rnd.randint(100000, 999999)}" if mode != "cash" else None))
def run():
    api.login()
    S = state.S; cat = {c["id"]: c for c in api.get("/pharmacy/catalog")}; code = {c["code"]: c for c in cat.values()}
    ph = state.bucket("pharm")
    for k, e in S["opd"].items():
        if not e.get("rx") or k in ph: continue
        rx = api.get(f"/opd/prescriptions/{e['rx']}")["items"]
        items = [dict(catalog_item_id=i["catalog_item_id"], drug_name=i["drug_name"], quantity=1 if cat[i["catalog_item_id"]].get("unit") in ("inhaler", "bottle", "vial") else qty(i["frequency"], i["duration"]),
                      unit_price=float(cat[i["catalog_item_id"]]["base_price"])) for i in rx if i.get("catalog_item_id") in cat]
        r = api.try_(api.post, "/pharmacy/orders", dict(patient_id=e["patient"], prescription_id=e["rx"], encounter_id=e["encounter"],
                     items=items, dispensing_type="prescription",
                     **({"safety_override_reason": "Controlled analgesic for fracture pain; short course reviewed by pharmacist"}
                        if any(cat[i["catalog_item_id"]].get("is_controlled") for i in items) else {})))
        if not r: continue
        ph[k] = dict(order=r["order"]["id"])
        state.save()
        if rnd.random() < 0.15: ph[k]["state"] = "awaiting_payment"; continue   # left at the counter, bill unpaid
        pay_open(e["patient"], e["encounter"], "pharmacy", rnd.choice(["cash", "upi", "upi", "card"]))
        body = {}
        if any(code_of(cat, it) in ("TRAM50",) for it in api.get(f"/pharmacy/orders/{ph[k]['order']}").get("items", [])):
            body["witnessed_by"] = S["users"]["nurse_anita"]
        if api.try_(api.put, f"/pharmacy/orders/{ph[k]['order']}/dispense", body): ph[k]["state"] = "dispensed"
        state.save()
    # NDPS opening receipts
    nd = state.bucket("ndps")
    for c, q in (("MORPH10", 20), ("TRAM50", 100)):
        if f"receipt:{c}" not in nd and api.try_(api.post, "/pharmacy/ndps-register", dict(catalog_item_id=code[c]["id"], action="receipt", quantity=q,
                notes="Opening stock received from licensed distributor (fictional)", witnessed_by=S["users"]["nurse_anita"])):
            nd[f"receipt:{c}"] = True
    # morphine for post-op TKR patient (IPD), dual sign-off
    tkr = S["ipd"].get("9000000049")
    if tkr and "morphine" not in nd:
        o = api.try_(api.post, "/pharmacy/orders", dict(patient_id=S["patients"]["9000000049"], encounter_id=tkr["encounter"], dispensing_type="prescription",
                     items=[dict(catalog_item_id=code["MORPH10"]["id"], drug_name=code["MORPH10"]["name"], quantity=2, unit_price=45)],
                     notes="Post-op analgesia, Dr. Rohan Desai",
                     safety_override_reason="Post-operative pain after total knee replacement; NDPS register entry made"))
        if o:
            nd["morphine"] = o["order"]["id"]
            api.try_(api.put, f"/pharmacy/orders/{o['order']['id']}/dispense", dict(witnessed_by=S["users"]["nurse_kamal"],
                         unpaid_override_reason="IPD - billed to the admission"))
            # dispensing writes the NDPS register itself; a manual "dispensed" entry would double-count
    # OTC counter sales
    otc = state.bucket("otc")
    for i, lines in enumerate([[("PCM500", 10), ("ORS", 4)], [("CETI10", 10)], [("ORS", 6)], [("PCM500", 15), ("CETI10", 5)], [("IFA", 30)]]):
        if str(i) in otc: continue
        r = api.try_(api.post, "/pharmacy/otc-sale", dict(items=[dict(catalog_item_id=code[c]["id"], drug_name=code[c]["name"], quantity=q,
                     unit_price=float(code[c]["base_price"])) for c, q in lines], notes="Walk-in OTC"))
        if r: otc[str(i)] = r.get("id") or r.get("order", {}).get("id", True)
    # one return: patient stopped a drug after an adverse reaction
    if "return" not in ph:
        for k, v in ph.items():
            if isinstance(v, dict) and v.get("state") == "dispensed":
                det = api.get(f"/pharmacy/orders/{v['order']}"); it = det["items"][0]
                if it["quantity"] >= 4:
                    r = api.try_(api.post, "/pharmacy/returns", dict(order_item_id=it["id"], patient_id=det["order"]["patient_id"],
                                 quantity_returned=it["quantity"] // 2, reason="Patient developed gastric upset; drug changed by doctor"))
                    if r: ph["return"] = dict(id=r.get("id"), order=v["order"], drug=it["drug_name"], qty=it["quantity"] // 2); break
    state.save()
    from collections import Counter; print(Counter(v.get("state") for v in ph.values() if isinstance(v, dict)))
def code_of(cat, it): return cat.get(it.get("catalog_item_id"), {}).get("code")
if __name__ == "__main__": run()
