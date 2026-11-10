"""Seed months of history through the historical-import API (Admin -> Import history).

    python3 run_history.py --months 12 --target-crore 10 [--go-live 2026-10-25T00:00:00+05:30] [--check]

Deterministic (fixed seed), resumable (each batch's external ids are skipped by the
server when re-sent), polite (one batch at a time; api.py backs off when slow).
"""
import argparse
import datetime as dt
import time

import api
import state
from history_plan import Plan


def plan_for(go_live, months, target, uhids):
    probe = Plan(go_live, months, 1.0, uhids).build()
    scale = target / probe.revenue
    plan = Plan(go_live, months, scale, uhids).build()
    print(f"scale {scale:.3f}: {sum(len(v) for v in plan.days.values()):,} records, Rs {plan.revenue / 1e7:.2f} crore planned")
    return plan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=12)
    ap.add_argument("--target-crore", type=float, default=10.0)
    ap.add_argument("--go-live", default="2026-10-25T00:00:00+05:30")
    ap.add_argument("--batch-size", type=int, default=200)
    ap.add_argument("--check", action="store_true", help="dry-run every batch, import nothing")
    ap.add_argument("--pause", type=float, default=5.0, help="seconds between batches (shared server: be polite)")
    a = ap.parse_args()
    go_live = dt.datetime.fromisoformat(a.go_live)
    api.login()
    current = api.get("/history-import/settings").get("go_live_at")
    if not current or dt.datetime.fromisoformat(current.replace("Z", "+00:00")) != go_live:
        api.put("/history-import/settings", {"go_live_at": go_live.isoformat()})
    # The live patients some history belongs to, frozen on the first run: imported patients get
    # UHIDs too, and letting them into this list would change the plan between runs.
    uhids = state.S.get("history_existing_uhids")
    if uhids is None:
        uhids = sorted(p["uhid"] for p in api.get("/patients?per_page=500")["patients"])
        state.S["history_existing_uhids"] = uhids
        state.save()
    plan = plan_for(go_live, a.months, a.target_crore * 1e7, uhids)
    done = state.bucket("history_batches")
    # Records are sent in a fixed order, so everything before the count already imported
    # is skipped without a round trip (the server would skip it anyway, by external id).
    imported = sum(t["added"] for b in api.get("/history-import/batches")
                   if b["status"] == "committed" and b["label"].startswith(f"Demo history {a.months}m")
                   for t in b["tallies"])
    t0, totals = time.time(), {}
    for i, batch in enumerate(plan.batches(a.batch_size)):
        key = f"{a.months}m:{a.target_crore}:{a.batch_size}:{i}"
        if (key in done or (i + 1) * a.batch_size <= imported) and not a.check:
            continue
        first, last = batch[0], batch[-1]
        label = f"Demo history {a.months}m, batch {i + 1} ({_day(first)} to {_day(last)})"
        tb = time.time()
        body = dict(label=label, dry_run=a.check, records=batch)
        try:
            r = api.call("POST", "/history-import/batches", body, timeout=900)
        except api.ApiError as e:
            if e.code != 401:
                raise
            api.login()   # the session expired during a long run
            r = api.call("POST", "/history-import/batches", body, timeout=900)
        for t in r["tallies"]:
            totals[t["kind"]] = totals.get(t["kind"], 0) + t["added"]
        print(f"batch {i + 1}: {len(batch)} records, {r['status']}, {time.time() - tb:.0f}s, problems {len(r['problems'])}", flush=True)
        if r["problems"]:
            for p in r["problems"][:10]:
                print("   ", p)
            raise SystemExit("stopping: fix the generator, then re-run (imported batches are skipped)")
        if not a.check:
            done[key] = r["batch_id"]
            state.save()
        time.sleep(a.pause + (time.time() - tb) * 0.5)   # back off more when batches run slow
    print(f"done in {(time.time() - t0) / 60:.0f} min; added {totals}")


def _day(rec):
    return next(v for k, v in rec.items() if k.endswith("_at"))[:10]


if __name__ == "__main__":
    main()
