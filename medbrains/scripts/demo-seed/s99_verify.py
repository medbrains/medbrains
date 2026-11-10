"""Read-back through the API: counts per module and cross-module linkage checks. Prints a JSON report."""
import json, api, state
def run():
    api.login(); S = state.S; out = {"counts": {}, "links": {}}
    pts = api.get("/patients?per_page=500")["patients"]; out["counts"]["patients"] = len(pts)
    ok = bad = 0; bad_rows = []
    for k, e in S["opd"].items():        # every OPD visit carries its consultation invoice
        inv = api.get(f"/patients/{e['patient']}/invoices")
        enc = api.get(f"/opd/encounters/{e['encounter']}")
        good = enc["patient_id"] == e["patient"] and any(i for i in inv)
        ok += good; bad += not good
        if not good: bad_rows.append(k)
    out["links"]["opd_visit->patient+invoice"] = dict(ok=ok, bad=bad, bad_rows=bad_rows[:5])
    ok = bad = 0
    for ph, a in S["ipd"].items():        # admission -> encounter, bed, discharge summary when discharged
        r = api.get(f"/ipd/admissions/{a['admission']}")["admission"]
        good = r["encounter_id"] == a["encounter"] and r["patient_id"] == S["patients"][ph]
        if a.get("discharged") is True:
            ds = api.try_(api.get, f"/ipd/admissions/{a['admission']}/discharge-summary")
            good = good and r["status"] == "discharged" and bool(ds) and ds.get("status") == "finalized"
        ok += good; bad += not good
    out["links"]["admission->encounter/patient/summary"] = dict(ok=ok, bad=bad)
    ok = bad = 0
    for k, p in S.get("pharm", {}).items():   # pharmacy order -> prescription of the same encounter
        if not isinstance(p, dict) or "order" not in p or k == "return": continue
        o = api.get(f"/pharmacy/orders/{p['order']}")["order"]; e = S["opd"].get(k)
        good = bool(e) and o["prescription_id"] == e.get("rx") and o["encounter_id"] == e["encounter"]
        ok += good; bad += not good
    out["links"]["pharmacy_order->prescription/encounter"] = dict(ok=ok, bad=bad)
    claims = api.get("/billing/insurance-claims"); ok = bad = 0
    for c in claims:
        inv = api.get(f"/billing/invoices/{c['invoice_id']}")["invoice"]
        good = inv["patient_id"] == c["patient_id"] and inv.get("admission_id") is not None
        ok += good; bad += not good
    out["links"]["claim->IPD invoice of same patient"] = dict(ok=ok, bad=bad)
    alerts = api.get("/lab/critical-alerts"); ok = bad = 0
    for a in alerts:
        o = api.get(f"/lab/orders/{a['order_id']}"); o = o.get("order", o)
        good = o["patient_id"] == a["patient_id"]; ok += good; bad += not good
    out["links"]["critical_alert->lab order patient"] = dict(ok=ok, bad=bad)
    pas = api.get("/insurance/prior-auths"); ok = bad = 0
    for p in pas:
        pol = api.get(f"/patients/{p['patient_id']}/insurance")
        good = any(x.get("id") == p["patient_insurance_id"] for x in pol); ok += good; bad += not good
    out["links"]["preauth->patient policy"] = dict(ok=ok, bad=bad)
    out["counts"].update({
        "opd_queue_today": len(api.get("/opd/queue")), "appointments": len(api.get("/opd/appointments?per_page=500")),
        "lab_orders": len(api.get("/lab/orders?per_page=1000")["orders"]), "critical_alerts": len(alerts),
        "radiology_orders": len((lambda r: r.get("orders", r) if isinstance(r, dict) else r)(api.get("/radiology/orders?per_page=500"))),
        "pharmacy_orders": len((lambda r: r.get("orders", r) if isinstance(r, dict) else r)(api.get("/pharmacy/orders?per_page=500"))),
        "invoices": api.get("/billing/invoices?per_page=1").get("total"), "claims": len(claims), "prior_auths": len(pas),
        "er_visits": len((lambda r: r.get("visits", r) if isinstance(r, dict) else r)(api.get("/emergency/visits"))),
        "mlc_cases": len(api.get("/emergency/mlc")), "day_closes": len(api.get("/billing/day-closes")),
    })
    print(json.dumps(out, indent=1))
if __name__ == "__main__": run()
