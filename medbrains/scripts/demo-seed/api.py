"""Tiny client for the G2DEMO backend (see README for the login variables)."""
import json, sys, urllib.request, urllib.error, http.cookiejar
_jar = http.cookiejar.CookieJar()
_op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_jar))
import os
BASE = os.environ.get("MB_DEMO_API", "http://127.0.0.1:3071/api")
_tok = None
_csrf = None
def _creds():
    """MB_DEMO_HOSPITAL / MB_DEMO_USER / MB_DEMO_PASSWORD, else the key: value file at MB_DEMO_LOGIN_FILE."""
    if os.environ.get("MB_DEMO_PASSWORD"):
        return {"hospital code": os.environ.get("MB_DEMO_HOSPITAL", "G2DEMO"), "username": os.environ.get("MB_DEMO_USER", "demo_admin"),
                "password": os.environ["MB_DEMO_PASSWORD"]}
    d = {}
    for line in open(os.environ.get("MB_DEMO_LOGIN_FILE", "/tmp/mb-demo-login.txt")):
        k, _, v = line.partition(":")
        d[k.strip()] = v.strip()
    return d
def login():
    global _tok, _csrf
    c = _creds()
    r = call("POST", "/auth/login", {"username": c["username"], "password": c["password"], "hospital_code": c["hospital code"]}, auth=False)
    _tok, _csrf = r.get("token"), r.get("csrf_token")
    step_up()
    return r
_stepped = 0
def step_up(force=False):
    """Prescribing & other high-risk writes need a 5-minute step-up cookie; refresh it every 4 minutes."""
    global _stepped
    import time
    if force or time.time() - _stepped > 240:
        call("POST", "/auth/step-up", {"password": _creds()["password"]})
        _stepped = time.time()
def call(method, path, body=None, auth=True, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    req.add_header("X-MedBrains-Client", "demo-seed")
    if auth and _tok:
        req.add_header("Authorization", "Bearer " + _tok)
    if auth and _csrf:
        req.add_header("X-CSRF-Token", _csrf)
    import time
    t0 = time.time()
    try:
        with _op.open(req, timeout=timeout) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise ApiError(e.code, method, path, e.read().decode()[:600])
    finally:
        _throttle(time.time() - t0)
class ApiError(Exception):
    def __init__(s, code, m, p, body): s.code, s.body = code, body; super().__init__(f"{code} {m} {p}: {body}")
def get(p): return call("GET", p)
def post(p, b=None):
    step_up()
    return call("POST", p, b if b is not None else {})
def put(p, b): return call("PUT", p, b)
def patch(p, b): return call("PATCH", p, b)
def try_(fn, *a):
    try: return fn(*a)
    except ApiError as e:
        print("  ERR", e, file=sys.stderr); return None
def _throttle(took):
    """Be polite to the shared demo backend: serial calls, a pause after each, back off hard when it is slow."""
    import time
    time.sleep(0.15 if took < 1 else min(10, 3 * took))
if __name__ == "__main__":
    login()
    r = call(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3] else None)
    print(json.dumps(r, indent=1, default=str)[:int(sys.argv[4]) if len(sys.argv) > 4 else 4000])
