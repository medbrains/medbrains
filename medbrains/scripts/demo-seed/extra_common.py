"""Extra modules for the G2DEMO tenant: OT, diet, HR, store/indent/procurement, camps, blood bank,
ICU, housekeeping, CSSD, infection control, quality, ambulance, BME, home health.
Re-runnable: ids live in extra_state.json; each module skips what it already created.
Shared helpers for the extra-module seed (s11_extra_modules.py)."""
import datetime as dt, json, os, re, sys
import api, state

P_X = os.environ.get("MB_DEMO_EXTRA_STATE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "extra_state.json"))
X = json.load(open(P_X)) if os.path.exists(P_X) else {}
def save(): json.dump(X, open(P_X, "w"), indent=1, default=str)
def bucket(n): return X.setdefault(n, {})

S = state.S; PT = S["patients"]; U = S["users"]; D = S["departments"]; IPD = S["ipd"]
TODAY = dt.date.today()
D0 = TODAY.isoformat()
def day(n): return (TODAY + dt.timedelta(days=n)).isoformat()
def ts(hhmm, n=0): return f"{day(n)}T{hhmm}:00+05:30"

def gap(method, path, err):
    """Record a product gap once (keyed by method+path)."""
    g = bucket("gaps"); k = f"{method} {re.sub(r'[0-9a-f]{8}-[0-9a-f-]{27}', '{id}', path.split('?')[0])}"
    g[k] = str(err)[:400]; save(); print("  GAP", k, str(err)[:300], file=sys.stderr)

def call(method, path, body=None):
    """One API call; on failure record a gap and return None."""
    api.step_up()
    try: return api.call(method, path, body)
    except api.ApiError as e:
        gap(method, path, e); return None

def lst(path, key=None):
    r = call("GET", path)
    if r is None: return []
    if isinstance(r, dict):
        for k in ([key] if key else []) + ["data", "items", "rows", "results"]:
            if k and isinstance(r.get(k), list): return r[k]
        lists = [v for v in r.values() if isinstance(v, list)]
        return lists[0] if lists else []
    return r

def once(b, key, fn):
    """Run fn() unless bucket b already has key; store the returned id."""
    bk = bucket(b)
    if key in bk: return bk[key]
    r = fn()
    if r is None: return None
    rid = r["id"] if isinstance(r, dict) and "id" in r else r
    bk[key] = rid; save(); return rid
