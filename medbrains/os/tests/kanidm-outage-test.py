#!/usr/bin/env python3
"""T3.2, the sign-in service dies during a shift. On a set-up debug image: staff already signed in to MedBrains
keep working, a new sign-in through Kanidm fails with a plain answer, and Kanidm comes back by itself.

  OS_WORK=... OS_WEB_PORT=8470 OS_IDP_PORT=8471 os/tests/kanidm-outage-test.py
"""
import importlib.util
import json
import sys
import time
from pathlib import Path

from kanidm_lib import ADMIN, WEB, curl, kanidm_auth, limit_opened, local_sign_in, new_jar, serial

spec = importlib.util.spec_from_file_location("onelogin", Path(__file__).with_name("kanidm-one-login-test.py"))
onelogin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(onelogin)
RESTART_LIMIT_S = 30
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def sso_sign_in():
    """A browser signed in to MedBrains through Kanidm. Returns its cookie file."""
    provider = serial("runuser -u postgres -- psql -X -tAq -d medbrains -c \"select id from identity_providers where code='kanidm'\"", 10).splitlines()[-1].strip()
    jar = new_jar()
    _, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    onelogin.walk_sign_in(headers["location"], jar, ADMIN[0], ADMIN[1])
    return jar, provider


def kanidm_pid():
    """kanidmd's main process, or 0."""
    return serial("systemctl show -p MainPID --value kanidmd", 8).splitlines()[-1].strip()


def test_killed_mid_shift(jar):
    """SIGKILL, as a crash would. Signed-in staff carry on; systemd starts Kanidm again."""
    before = kanidm_pid()
    serial("systemctl kill -s KILL kanidmd", 8)
    started = time.time()
    me = curl(f"{WEB}/api/auth/me", jar=jar)
    check("a person signed in through Kanidm keeps working while it is down", me[0] == 200, str(me[0]))
    patients = curl(f"{WEB}/api/patients?page=1&per_page=1", jar=jar)
    check("and can still open a list", patients[0] == 200, str(patients[0]))
    while time.time() - started < RESTART_LIMIT_S:
        time.sleep(1)
        if serial("systemctl is-active kanidmd", 8).splitlines()[-1].strip() == "active" and kanidm_pid() not in ("0", before):
            break
    took = time.time() - started
    check(f"Kanidm starts again by itself within {RESTART_LIMIT_S} s", took < RESTART_LIMIT_S, f"{took:.0f}s, pid {before} -> {kanidm_pid()}")
    time.sleep(3)
    check("and takes sign-ins again", bool(kanidm_auth(ADMIN[0], ADMIN[1], privileged=False)[0]))


def test_down_for_longer(jar, provider):
    """Held down, as when it will not start: the existing session lives, a new sign-in gets a plain answer."""
    serial("systemctl mask --runtime kanidmd; systemctl stop kanidmd", 20)
    me = curl(f"{WEB}/api/auth/me", jar=jar)
    check("held down: the signed-in person still works", me[0] == 200, str(me[0]))
    refreshed = curl(f"{WEB}/api/auth/refresh", "POST", jar=jar)
    print("INFO  refresh while down:", refreshed[0], str(refreshed[1])[:120], flush=True)
    status, body, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=new_jar())
    print("INFO  a new sign-in through Kanidm:", status, headers.get("location", "")[:120], str(body)[:200], flush=True)
    check("a new sign-in goes back to the sign-in page, which says the service is not answering",
          status in (302, 303, 307) and headers.get("location", "").endswith("/login?sso_error=unavailable"), str(status))
    local = curl(f"{WEB}/api/auth/login", "POST", body={"username": ADMIN[0], "password": ADMIN[1]}, jar=new_jar())
    print("INFO  the first administrator's local sign-in while Kanidm is down:", local[0], flush=True)
    serial("systemctl unmask --runtime kanidmd; systemctl daemon-reload; systemctl start kanidmd; sleep 6", 40)


def main():
    """Both outages, then the state Kanidm is left in."""
    limit_opened(True)
    jar, provider = sso_sign_in()
    me = curl(f"{WEB}/api/auth/me", jar=jar)[1]
    print("INFO  signed in through Kanidm as:", me.get("username") if isinstance(me, dict) else me, flush=True)
    test_killed_mid_shift(jar)
    test_down_for_longer(jar, provider)
    check("Kanidm is running at the end", serial("systemctl is-active kanidmd", 8).splitlines()[-1].strip() == "active")
    limit_opened(False)
    print(json.dumps({"failed": failed}))
    print("FAILED" if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
