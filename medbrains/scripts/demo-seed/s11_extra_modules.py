"""Extra modules for the G2DEMO tenant: OT, diet, HR, store/indent/procurement, camps, blood bank,
ICU, housekeeping, CSSD, infection control, quality, ambulance, BME, home health and more.
Re-runnable: ids live in extra_state.json; each module skips what it already created.
Run:  python3 s11_extra_modules.py [module ...]   |   python3 s11_extra_modules.py --verify"""
import sys, traceback
from extra_common import S, IPD, PT, U, X, api, call, gap, lst, save
from extra_clinical import DIETS, seed_blood, seed_camp, seed_diet, seed_hr, seed_ot, seed_store
from extra_ops import ICU, seed_icu, seed_housekeeping, seed_cssd, seed_infection, seed_quality, seed_ambulance, seed_bme, seed_home, seed_consents, seed_tele, seed_chronic, seed_mrd, seed_front_office, seed_comms, seed_maternity, seed_dental_ophtho, seed_quality_indicators, seed_lms, seed_facilities


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
