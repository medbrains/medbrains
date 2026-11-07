#!/usr/bin/env python3
"""One login from setup, on a booted debug image that has NOT been set up. Refusals first, then a failed
Kanidm step that must leave nothing behind, then the real setup, then what that login can do.

  OS_WORK=... OS_WEB_PORT=8470 OS_IDP_PORT=8471 os/tests/kanidm-one-login-test.py
"""
import hashlib, hmac, json, re, struct, sys, time

from kanidm_lib import ADMIN, IDP, WEB, cookie, curl, kanidm_auth, local_sign_in, must, new_jar, recover_password, serial, setup_call, set_up_machine

# What setup's rule should take and refuse, with the username this test uses.
ACCEPTED = ["Blue-River-Walks-At-7!", "My dog Rocky eats 3 apples", "Sunflower ward 7 is bright"]
REFUSED = ["Test@1234", "Nurse@2026", "Short-1!", "Password@1234567", "P@ssw0rd1234567!", "Aaaaaaaaaaaaaaa1!",
           "asha_admin-Blue-River-7!", "blue river walks at seven"]
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def form(username, password):
    """The fields the setup screen sends."""
    return {"hospital": "Test Hospital", "username": username, "password": password}


def test_rule_on_the_screen():
    """The rule is shown before typing, and each sample gets the answer the rule promises."""
    code, answer = setup_call("/hospital/check", form("", ""))
    print("INFO  rule shown:", answer[-240:].replace("\n", " "), flush=True)
    check("the screen shows Kanidm's real rule", "15 characters" in answer, code)
    for sample in ACCEPTED:
        code, answer = setup_call("/hospital/check", form(ADMIN[0], sample))
        check(f"setup takes {sample!r}", code == "200", code)
    for sample in REFUSED:
        code, answer = setup_call("/hospital/check", form(ADMIN[0], sample))
        check(f"setup refuses {sample!r}", code == "422", code)
    code, answer = setup_call("/hospital", form("admin", ADMIN[1]))
    check("the name admin is refused, because Kanidm keeps it", code == "422" and '"username"' in answer, code)


def machine_state():
    """Whether setup left a mark: the role marker and any seed lines."""
    return serial("ls /var/lib/medbrains/config/role-main 2>/dev/null | wc -l; grep -c MEDBRAINS_SEED /var/lib/medbrains/config/env; true", 10).split()[-2:]


def test_failed_step_is_safe():
    """Kanidm stopped: setup must say so, leave nothing, and work when tried again."""
    serial("systemctl mask --runtime kanidmd; systemctl stop kanidmd; sleep 1", 20)
    started = time.time()
    code, answer = setup_call("/hospital", form(ADMIN[0], ADMIN[1]))
    print(f"INFO  with Kanidm down, after {time.time() - started:.0f}s:", code, answer[-120:].replace("\n", " "), flush=True)
    check("setup says the sign-in service failed", code == "500" and "Try again" in answer, code)
    check("and leaves no role marker and no seed", machine_state() == ["0", "0"], str(machine_state()))
    serial("systemctl unmask --runtime kanidmd; systemctl daemon-reload; systemctl start --no-block kanidmd; sleep 8", 30)


def test_nothing_left_on_disk():
    """The password must not sit in a log, a file or a process's arguments."""
    secret = ADMIN[1]
    found = serial(f"grep -rlF -- '{secret}' /var/lib/medbrains /var/lib/kanidm /etc/kanidm /run/medbrains-console /var/log 2>/dev/null | wc -l; "
                   f"journalctl -b --no-pager | grep -cF -- '{secret}'; true", 90).split()[-2:]
    check("the password is in no file and no log", found == ["0", "0"], str(found))
    print("INFO  env holds only its hash until the server has read it:", serial("grep -c MEDBRAINS_SEED /var/lib/medbrains/config/env; true", 8)[-3:].strip(), flush=True)


def test_login():
    """The chosen login works in Kanidm and MedBrains, and only with the right password."""
    token = kanidm_auth(ADMIN[0], ADMIN[1], privileged=False)[0]
    check("Kanidm takes the login chosen at setup", bool(token))
    check("and refuses a wrong password", not kanidm_auth(ADMIN[0], "Blue-River-Walks-At-8!", privileged=False)[0])
    time.sleep(3)
    jar = local_sign_in()
    me = curl(f"{WEB}/api/auth/me", jar=jar)[1]
    check("MedBrains' own form takes it too", me.get("username") == ADMIN[0], str(me.get("role")))
    return token


def walk_sign_in(url, jar, username, password):
    """A browser through Kanidm's pages, back to the app. Returns the last status and redirect."""
    status, text, headers = curl(url, jar=jar)
    origin = "https://idm.medbrains.local:9443"
    extra = ("-H", f"Origin: {origin}", "-H", f"Referer: {origin}/ui/login")
    for _ in range(12):
        target = headers.get("location") or headers.get("hx-redirect")
        if target:
            target = target if target.startswith("http") else origin + target
            if target.startswith(WEB):
                return curl(target, jar=jar)
            status, text, headers = curl(target, jar=jar)
        elif 'action="/ui/login/begin"' in str(text):
            status, text, headers = curl(f"{origin}/ui/login/begin", "POST", jar=jar, form={"username": username, "password": "", "totp": ""}, extra=extra)
        elif 'action="/ui/login/mech_choose"' in str(text):
            # A person with a passkey as well is asked how to sign in; these tests use the password.
            status, text, headers = curl(f"{origin}/ui/login/mech_choose", "POST", jar=jar, form={"mech": "password"}, extra=extra)
        elif 'action="/ui/login/pw"' in str(text):
            status, text, headers = curl(f"{origin}/ui/login/pw", "POST", jar=jar, form={"password": password}, extra=extra)
        elif "consent_token" in str(text):
            token = re.search(r'name="consent_token"\s+value="([^"]+)"', str(text)).group(1)
            status, text, headers = curl(f"{origin}/ui/oauth2/consent", "POST", jar=jar, form={"consent_token": token}, extra=extra)
        else:
            break
    return status, text, headers


def test_one_sign_in():
    """The first administrator signs in to MedBrains through Kanidm, and stays the same account."""
    providers = curl(f"{WEB}/api/auth/sso/providers?domain=medbrains.local")[1]
    print("INFO  providers offered:", providers, flush=True)
    provider = serial("runuser -u postgres -- psql -X -tAq -d medbrains -c \"select id from identity_providers where code='kanidm'\"", 10).splitlines()[-1].strip()
    jar = new_jar()
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    status, text, headers = walk_sign_in(headers["location"], jar, ADMIN[0], ADMIN[1])
    me = curl(f"{WEB}/api/auth/me", jar=jar)[1]
    check("the admin signs in to MedBrains through Kanidm, as the same account",
          isinstance(me, dict) and me.get("username") == ADMIN[0] and me.get("role") in ("super_admin", "hospital_admin"),
          f"{status} {str(me)[:100]}")
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    must(curl(f"{IDP}/v1/person", "POST", token, {"attrs": {"name": ["ward.nurse"], "displayname": ["Ward Nurse"], "mail": ["ward.nurse@hospital.test"]}}), "person")
    reset = serial("/usr/lib/medbrains/kanidm-reset-password ward.nurse", 20)
    check("IT's reset gives a link", "/ui/reset?token=" in reset, reset[-70:])
    intent = reset.rsplit("token=", 1)[-1].split()[0]
    session, _ = must(curl(f"{IDP}/v1/credential/_exchange_intent", "POST", body=intent), "exchange")
    must(curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": "Ward nurse likes 3 green mangoes"}, session]), "password")
    must(curl(f"{IDP}/v1/credential/_commit", "POST", body=session), "commit")
    jar = new_jar()
    status, _, headers = curl(f"{WEB}/api/auth/sso/{provider}/authorize", jar=jar)
    walk_sign_in(headers["location"], jar, "ward.nurse", "Ward nurse likes 3 green mangoes")
    me = curl(f"{WEB}/api/auth/me", jar=jar)[1]
    check("a new member of staff gets one account, with the least role, and no second password",
          isinstance(me, dict) and me.get("role") == "staff", str(me.get("username") if isinstance(me, dict) else me))
    hashed = serial("runuser -u postgres -- psql -X -tAq -d medbrains -c \"select count(*) from users where external_subject is not null and password_hash is null\"", 10).splitlines()[-1].strip()
    check("MedBrains keeps no password for them", hashed != "0", hashed)


def totp_code(secret):
    """The code an authenticator app would show now, for Kanidm's default: SHA-256, 30 seconds, 6 digits."""
    digest = hmac.new(bytes(secret["secret"]), struct.pack(">Q", int(time.time() // secret["step"])), hashlib.sha256).digest()
    offset = digest[-1] & 15
    return (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7fffffff) % 10 ** secret["digits"]


def credential_session(token, name):
    """IT's reset link, opened."""
    intent = must(curl(f"{IDP}/v1/person/{name}/_credential/_update_intent/900", token=token), "intent")
    return must(curl(f"{IDP}/v1/credential/_exchange_intent", "POST", body=intent["token"]), "exchange")[0]


def sign_in_with_code(name, password, code):
    """Signs in with a password and a one-time code. Returns the token, or None."""
    _, body, headers = curl(f"{IDP}/v1/auth", "POST", body={"step": {"init2": {"username": name, "issue": "token", "privileged": False}}})
    extra = ("-H", f"X-KANIDM-AUTH-SESSION-ID: {headers['x-kanidm-auth-session-id']}")
    curl(f"{IDP}/v1/auth", "POST", body={"step": {"begin": "passwordmfa"}}, extra=extra)
    curl(f"{IDP}/v1/auth", "POST", body={"step": {"cred": {"totp": code}}}, extra=extra)
    body = curl(f"{IDP}/v1/auth", "POST", body={"step": {"cred": {"password": password}}}, extra=extra)[1]
    return body.get("state", {}).get("success") if isinstance(body, dict) else None


def test_second_step_group():
    """What the IT group does. Kanidm checks its rule when a credential is saved, not at sign-in (its own TODO in
    authsession/mod.rs), so moving someone in takes two steps: add them, then clear their password."""
    token = kanidm_auth("idm_admin", recover_password("idm_admin"))[0]
    password = "IT person types 9 long words"
    must(curl(f"{IDP}/v1/person", "POST", token, {"attrs": {"name": ["it.person"], "displayname": ["IT Person"]}}), "person")
    session = credential_session(token, "it.person")
    must(curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": password}, session]), "password")
    must(curl(f"{IDP}/v1/credential/_commit", "POST", body=session), "commit")
    check("before the group, a password signs in", bool(kanidm_auth("it.person", password, privileged=False)[0]))
    must(curl(f"{IDP}/v1/group/mb_it_admins/_attr/member", "POST", token, ["it.person"]), "member")
    check("KANIDM LIMIT: joining the group alone does not stop an existing password", bool(kanidm_auth("it.person", password, privileged=False)[0]))
    must(curl(f"{IDP}/v1/person/it.person/_attr/primary_credential", "DELETE", token), "clear")
    check("IT clears the password, and it stops working", not kanidm_auth("it.person", password, privileged=False)[0])
    session = credential_session(token, "it.person")
    status = curl(f"{IDP}/v1/credential/_update", "POST", body=[{"password": password}, session])[1]
    check("a password alone cannot be saved", status.get("can_commit") is False and "MfaRequired" in status.get("warnings", []), str(status.get("warnings")))
    secret = must(curl(f"{IDP}/v1/credential/_update", "POST", body=["totpgenerate", session]), "generate")["mfaregstate"]["TotpCheck"]
    must(curl(f"{IDP}/v1/credential/_update", "POST", body=[{"totpverify": [totp_code(secret), "phone"]}, session]), "verify")
    must(curl(f"{IDP}/v1/credential/_commit", "POST", body=session), "commit")
    check("with a one-time code it saves, and a password alone no longer signs in", not kanidm_auth("it.person", password, privileged=False)[0])
    check("the password and the code together sign in", bool(sign_in_with_code("it.person", password, totp_code(secret))))


def main():
    """Every step, in the order a machine meets them."""
    if serial("ls /var/lib/medbrains/config/role-main 2>/dev/null; true", 8).strip() == "":
        test_rule_on_the_screen()
        test_failed_step_is_safe()
        set_up_machine()
    test_nothing_left_on_disk()
    test_login()
    test_one_sign_in()
    test_second_step_group()
    print(json.dumps({"failed": failed}))
    print("FAILED" if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
