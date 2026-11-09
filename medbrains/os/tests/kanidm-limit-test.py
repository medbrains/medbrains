#!/usr/bin/env python3
"""The owner's rule: 200 wrong guesses from one address must leave the real person able to sign in from another.
On a set-up debug image. The guesses come from this computer; the real person from the machine's own LAN address,
which the front counts separately, so this runs with the front's real limit.

  OS_WORK=... OS_IDP_PORT=8471 os/tests/kanidm-limit-test.py
"""
import json, sys, time

from kanidm_lib import ADMIN, IDP, curl, limit_opened, serial

GUESSES = 200
OTHER_ADDRESS_WAIT_S = 12
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def guess():
    """One wrong password, the way the browser's sign-in page sends it. Returns the front's status."""
    status, _, headers = curl(f"{IDP}/v1/auth", "POST", body={"step": {"init2": {"username": ADMIN[0], "issue": "token", "privileged": False}}})
    session = headers.get("x-kanidm-auth-session-id")
    if status == 429 or not session:
        return status
    extra = ("-H", f"X-KANIDM-AUTH-SESSION-ID: {session}")
    status = curl(f"{IDP}/v1/auth", "POST", body={"step": {"begin": "password"}}, extra=extra)[0]
    if status == 429:
        return status
    return curl(f"{IDP}/v1/auth", "POST", body={"step": {"cred": {"password": "Wrong-Guess-Over-And-Over-1"}}}, extra=extra)[0]


def sign_in_from_lan_address():
    """The real person, from the machine's own LAN address: not this computer's, and not loopback."""
    steps = [{"step": {"init2": {"username": ADMIN[0], "issue": "token", "privileged": False}}},
             {"step": {"begin": "password"}}, {"step": {"cred": {"password": ADMIN[1]}}}]
    script = ("A=$(ip -4 -o addr show scope global | awk '{print $4}' | cut -d/ -f1 | head -1); "
              "C=\"curl -sk -m 20 --resolve idm.medbrains.local:9443:$A -H Content-Type:application/json\"; U=https://idm.medbrains.local:9443/v1/auth; "
              f"S=$($C -D - -o /dev/null -d '{json.dumps(steps[0])}' $U | tr -d '\\r' | sed -n 's/^x-kanidm-auth-session-id: //Ip'); "
              f"$C -o /dev/null -H \"X-KANIDM-AUTH-SESSION-ID: $S\" -d '{json.dumps(steps[1])}' $U; "
              f"$C -H \"X-KANIDM-AUTH-SESSION-ID: $S\" -d '{json.dumps(steps[2])}' $U | grep -c '\"success\"'; true")
    return serial(script, 60).splitlines()[-1].strip() == "1"


def main():
    """200 guesses, what the front did with them, then the real person."""
    limit_opened(False)
    started = time.time()
    answers = {}
    for _ in range(GUESSES):
        status = guess()
        answers[status] = answers.get(status, 0) + 1
    print(f"INFO  {GUESSES} guesses from one address in {time.time() - started:.0f}s: {answers}", flush=True)
    check("the front refuses most of them", answers.get(429, 0) >= GUESSES // 2, str(answers))
    time.sleep(OTHER_ADDRESS_WAIT_S)
    check("the real person signs in from another address", sign_in_from_lan_address())
    print("FAILED" if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
