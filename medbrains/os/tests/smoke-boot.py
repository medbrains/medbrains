#!/usr/bin/env python3
"""Boots a just-built x86-64 release image headless, with a TPM, and fails unless first boot reaches the
recovery key screen.

  os/tests/smoke-boot.py IMAGE.raw [--minutes 40] [--work DIR]

Linux only (the release's os-image container): needs qemu-system-x86, ovmf, swtpm and
e2fsprogs. Uses KVM when /dev/kvm is writable, else TCG (slow: see os/README.md "Test an image").

A release image has no shell and prints nothing on its serial port, so this boots a smoke copy: the
same image with one extra unit in its system partition (written offline with debugfs) that waits for
first boot to settle and reports on the serial port. The system partition is not measured, so the copy
boots the same signed boot file and seals to the TPM the same way. The copy is deleted; it is never
uploaded. The image itself is opened read-only.

Passes when, on first boot with a TPM 2.0:
  - the recovery key screen is on tty1, and the machine is not in emergency mode;
  - the data partition is sealed to the TPM and /var is on it;
  - the network unit and the MedBrains app manifest are readable by an unprivileged user.
Not covered: the setup screen after the key (needs a person to type part of it back), Secure Boot
enforcement (the firmware has no keys enrolled), arm64, and real hardware's firmware and TPM.
"""
import argparse, os, re, shutil, signal, struct, subprocess, tempfile, time

REPORT = r"""#!/bin/bash
# Smoke copy only (os/tests/smoke-boot.py): reports first boot on the serial port. Never released.
say() { echo "SMOKE $1=$2" > /dev/ttyS0; }
ok() { if "$@" >/dev/null 2>&1; then echo yes; else echo no; fi; }
key() { grep -q "write down this disk's recovery key" /dev/vcs1; }
as_nobody() { setpriv --reuid=65534 --regid=65534 --clear-groups cat "$1"; }
for _ in $(seq 1 3600); do
    key && break
    grep -q "no security chip" /dev/vcs1 && break
    systemctl is-active -q emergency.target && break
    sleep 1
done
sleep 2
say recovery-key-shown "$(ok key)"
say emergency "$(ok systemctl is-active -q emergency.target)"
say no-tpm-prompt "$(ok grep -q "no security chip" /dev/vcs1)"
say tpm-sealed "$(ok sh -c 'systemd-cryptenroll /dev/disk/by-partlabel/medbrains-data | grep -qw tpm2')"
say var-encrypted "$(ok sh -c 'findmnt -n -o SOURCE /var | grep -qx /dev/mapper/medbrains-data')"
say network-unit-readable "$(ok as_nobody /etc/systemd/network/80-wired.network)"
say app-manifest-readable "$(ok as_nobody /usr/share/medbrains/apps/medbrains.json)"
systemctl --failed --no-legend --plain | sed 's/^/SMOKE failed-unit /' > /dev/ttyS0
echo SMOKE-END > /dev/ttyS0
"""
UNIT = """[Unit]
Description=Smoke copy only: first-boot report on the serial port
DefaultDependencies=no
After=dev-%i.device
IgnoreOnIsolate=yes

[Service]
Type=oneshot
ExecStart=/usr/lib/medbrains/smoke-report
"""
RULE = 'ACTION=="add", SUBSYSTEM=="tty", KERNEL=="ttyS0", TAG+="systemd", ENV{SYSTEMD_WANTS}+="medbrains-smoke@%k.service"\n'
WANTED = {"recovery-key-shown": "yes", "emergency": "no", "no-tpm-prompt": "no", "tpm-sealed": "yes", "var-encrypted": "yes",
          "network-unit-readable": "yes", "app-manifest-readable": "yes"}
# Lines that end the wait early: the boot has failed and will not recover by itself.
FATAL = re.compile(r"You are in emergency mode|Cannot open access to console|Kernel panic")
OVMF = ("/usr/share/OVMF/OVMF_CODE_4M.fd", "/usr/share/OVMF/OVMF_VARS_4M.fd")


def run(*cmd, **kw):
    """Runs a command, failing loudly."""
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw).stdout


def root_offset(raw):
    """Byte offset of system slot A (the GPT partition labelled medbrains_<version>)."""
    with open(raw, "rb") as f:
        f.seek(512)
        hdr = f.read(92)
        ent_lba, n_ent, ent_sz = struct.unpack_from("<QII", hdr, 72)
        for i in range(n_ent if hdr[:8] == b"EFI PART" else 0):
            f.seek(ent_lba * 512 + i * ent_sz)
            e = f.read(ent_sz)
            if e[:16] != bytes(16) and e[56:128].decode("utf-16le").rstrip("\0").startswith("medbrains_"):
                return struct.unpack_from("<Q", e, 32)[0] * 512
    raise SystemExit(f"{raw}: no medbrains_* partition")


def make_smoke_copy(image, work):
    """A sparse copy of the image with the report unit written into slot A, offline."""
    raw = f"{work}/smoke.raw"
    run("cp", "--sparse=always", image, raw)
    files = {"smoke-report": REPORT, "smoke.service": UNIT, "smoke.rules": RULE}
    for name, text in files.items():
        with open(f"{work}/{name}", "w") as f:
            f.write(text)
    cmds = [f"write {work}/smoke-report /usr/lib/medbrains/smoke-report",
            f"write {work}/smoke.service /usr/lib/systemd/system/medbrains-smoke@.service",
            f"write {work}/smoke.rules /usr/lib/udev/rules.d/90-medbrains-smoke.rules"]
    modes = {"/usr/lib/medbrains/smoke-report": "0100755", "/usr/lib/systemd/system/medbrains-smoke@.service": "0100644",
             "/usr/lib/udev/rules.d/90-medbrains-smoke.rules": "0100644"}
    for path, mode in modes.items():
        cmds += [f"set_inode_field {path} mode {mode}", f"set_inode_field {path} uid 0", f"set_inode_field {path} gid 0"]
    with open(f"{work}/debugfs.cmds", "w") as f:
        f.write("\n".join(cmds) + "\n")
    out = subprocess.run(["debugfs", "-w", "-f", f"{work}/debugfs.cmds", f"{raw}?offset={root_offset(raw)}"],
                         text=True, capture_output=True)
    if out.returncode or re.search(r"(?m)^(?!debugfs ).*(error|not found|No such)", out.stdout + out.stderr, re.I):
        raise SystemExit(f"debugfs could not write the report unit:\n{out.stdout}{out.stderr}")
    return raw


def boot(raw, work, deadline):
    """Boots the smoke copy with a fresh software TPM; returns the report, or why there is none."""
    os.makedirs(f"{work}/tpm")
    tpm = subprocess.Popen(["swtpm", "socket", "--tpm2", "--tpmstate", f"dir={work}/tpm",
                            "--ctrl", f"type=unixio,path={work}/tpm.sock", "--log", f"file={work}/swtpm.log"])
    run("qemu-img", "create", "-q", "-f", "qcow2", "-F", "raw", "-b", raw, f"{work}/disk.qcow2", "16G")
    shutil.copy(OVMF[1], f"{work}/vars.fd")
    kvm = os.access("/dev/kvm", os.W_OK)
    serial = f"{work}/serial.log"
    for _ in range(50):
        if os.path.exists(f"{work}/tpm.sock"):
            break
        time.sleep(0.1)
    qemu = subprocess.Popen([
        "qemu-system-x86_64", "-machine", "q35", "-accel", "kvm" if kvm else "tcg,thread=multi",
        "-cpu", "host" if kvm else "max", "-smp", "4", "-m", "4096", "-no-reboot", "-display", "none",
        "-drive", f"if=pflash,format=raw,readonly=on,file={OVMF[0]}", "-drive", f"if=pflash,format=raw,file={work}/vars.fd",
        "-drive", f"if=virtio,format=qcow2,file={work}/disk.qcow2",
        "-netdev", "user,id=n0", "-device", "virtio-net-pci,netdev=n0",
        "-chardev", f"socket,id=tpm,path={work}/tpm.sock", "-tpmdev", "emulator,id=tpm0,chardev=tpm",
        "-device", "tpm-tis,tpmdev=tpm0", "-chardev", f"file,id=s0,path={serial}", "-serial", "chardev:s0"])
    print(f"smoke-boot: booting under {'KVM' if kvm else 'TCG'}", flush=True)
    try:
        return watch(serial, qemu, deadline)
    finally:
        for p in (qemu, tpm):
            if p.poll() is None:
                p.send_signal(signal.SIGTERM)
                try:
                    p.wait(10)
                except subprocess.TimeoutExpired:
                    p.kill()


def watch(serial, qemu, deadline):
    """Follows the serial log until the report ends, the boot fails, QEMU exits, or time runs out."""
    report, text = {}, ""
    while time.monotonic() < deadline:
        time.sleep(2)
        if os.path.exists(serial):
            with open(serial, errors="replace") as f:
                text = f.read()
        for key, value in re.findall(r"(?m)^SMOKE ([\w-]+)=(\S+)", text):
            report[key] = value
        if "SMOKE-END" in text:
            return report, re.findall(r"(?m)^SMOKE failed-unit (.*)$", text), None
        fatal = FATAL.search(text)
        if fatal:
            return report, [], f"first boot failed: serial shows {fatal.group(0)!r}"
        if qemu.poll() is not None:
            return report, [], f"the machine stopped (QEMU exit {qemu.returncode})"
    return report, [], "no report before the time limit"


def main():
    """Boots the image and exits non-zero unless every first-boot check passed."""
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("image")
    ap.add_argument("--minutes", type=float, default=40)
    ap.add_argument("--work")
    args = ap.parse_args()
    deadline = time.monotonic() + args.minutes * 60
    work = args.work or tempfile.mkdtemp(prefix="smoke-boot-")
    started = time.monotonic()
    try:
        report, failed_units, why = boot(make_smoke_copy(args.image, work), work, deadline)
        with open(f"{work}/serial.log", errors="replace") as f:
            tail = f.read()[-4000:]
    finally:
        if not args.work:
            shutil.rmtree(work, ignore_errors=True)
    minutes = (time.monotonic() - started) / 60
    bad = [f"{k}={report.get(k, 'missing')} (wanted {v})" for k, v in WANTED.items() if report.get(k) != v]
    for unit in failed_units:
        print(f"smoke-boot: failed unit: {unit}")
    if why or bad:
        print(f"--- last of the serial log ---\n{tail}\n---")
        raise SystemExit(f"smoke-boot: FAILED after {minutes:.1f} min: {why or '; '.join(bad)}")
    print(f"smoke-boot: passed in {minutes:.1f} min: " + ", ".join(f"{k}={v}" for k, v in report.items()))


if __name__ == "__main__":
    main()
