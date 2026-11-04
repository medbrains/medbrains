#!/usr/bin/env python3
"""Proves Restart through the service the screen uses: the boot id changes, setup is not asked
again and the shell is back. Runs against a debug image that has finished setup, in QEMU.

  OS_WORK=/tmp/mb-osimage-shell os/tests/restart.py
"""
import importlib.util
import os
import sys
import time

SPEC = importlib.util.spec_from_file_location("vm", os.path.join(os.path.dirname(__file__), "vm.py"))
VM = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VM)
LIMIT_SECONDS = 180
BOOT_ID = "cat /proc/sys/kernel/random/boot_id"
POST = ("T=$(cat /run/medbrains-console/setup-token); curl -s -m 10 -o /dev/null -w '%{http_code}' "
        "-H \"X-Setup-Token: $T\" -d '{\"action\":\"restart\"}' http://127.0.0.1:3100/power")


def last_line(text):
    """The last line of a command's output: what it printed, after the echoed command."""
    return text.strip().splitlines()[-1].strip() if text.strip() else ""


def main():
    """Asks for a restart, waits for a new boot, and checks what came back."""
    before = last_line(VM.serial(BOOT_ID))
    # The shell usually dies with the machine before it can print the answer, so only a refusal
    # counts here; what proves the restart is the new boot id.
    try:
        status = last_line(VM.serial(POST, 5))
    except OSError:
        status = ""
    if status.endswith(("403", "422", "500")):
        sys.exit(f"FAIL: /power answered {status}")
    deadline = time.time() + LIMIT_SECONDS
    time.sleep(10)
    while time.time() < deadline:
        try:
            now = last_line(VM.serial(BOOT_ID, 5))
        except OSError:
            now = ""  # The serial socket is briefly refused around a reset.
        if len(now) == 36 and now != before:
            break
        time.sleep(3)
    else:
        sys.exit(f"FAIL: no new boot in {LIMIT_SECONDS} s")
    time.sleep(20)
    shell = last_line(VM.serial("pgrep -c medbrains-shell"))
    marker = last_line(VM.serial("ls /var/lib/medbrains/config/role-main"))
    if shell == "0" or "role-main" not in marker:
        sys.exit(f"FAIL: shell {shell}, marker {marker}")
    print(f"PASS: restarted in under {LIMIT_SECONDS} s, shell running, setup not repeated")


if __name__ == "__main__":
    main()
