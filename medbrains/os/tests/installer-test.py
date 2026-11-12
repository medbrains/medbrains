#!/usr/bin/env python3
"""Proves the installer .iso in QEMU, through its serial console, the way an operator would use it:

  1. it boots from the ISO attached as a USB stick, next to one blank disk;
  2. the stick is not offered, and typing its name is refused;
  3. naming the blank disk and then answering anything but ERASE <name> writes nothing (checked on the host);
  4. ERASE <name> writes, checks and restarts;
  5. the blank disk now holds the image byte for byte, and boots on its own (debug image: its serial shell
     answers from the installed system's root partition).

  os/tests/installer-test.py <installer.iso> <image.raw> [x86-64|arm64]

Hold the shared lock (/tmp/mb-osimage.lock) around it: x86-64 runs under TCG and takes a while.
"""
import hashlib, os, shutil, socket, subprocess, sys, tempfile, time

ISO, RAW = sys.argv[1], sys.argv[2]
ARCH = sys.argv[3] if len(sys.argv) > 3 else "x86-64"
SHARE = os.path.join(os.path.dirname(os.path.dirname(shutil.which("qemu-img"))), "share", "qemu")
SLOW = 8 if ARCH == "x86-64" and os.uname().machine == "arm64" else 1
BLANK_DISK_GB = 16
if ARCH == "x86-64":
    QEMU, CODE, VARS = "qemu-system-x86_64", "edk2-x86_64-code.fd", "edk2-i386-vars.fd"
    MACHINE = ["-machine", "q35", "-accel", "tcg,thread=multi", "-cpu", "max"]
    TARGET = "vda"
else:
    QEMU, CODE, VARS = "qemu-system-aarch64", "edk2-aarch64-code.fd", "edk2-arm-vars.fd"
    accel = "hvf" if sys.platform == "darwin" else "kvm"
    MACHINE = ["-machine", "virt", "-accel", accel, "-cpu", "host"]
    TARGET = "vda"


class Machine:
    """One QEMU run with its serial port on a socket; everything it printed is kept in `seen`."""

    def __init__(self, work, with_stick):
        self.sock_path = os.path.join(work, "serial.sock")
        drives = ["-drive", f"if=virtio,format=qcow2,file={work}/target.qcow2"]
        if with_stick:
            # snapshot=on: the stick looks writable to the guest, as a real one does, and stays untouched.
            drives += ["-device", "qemu-xhci", "-drive", f"if=none,id=stick,format=raw,snapshot=on,file={ISO}",
                       "-device", "usb-storage,drive=stick"]
        self.qemu = subprocess.Popen([QEMU, *MACHINE, "-smp", "4", "-m", "2048",
            "-drive", f"if=pflash,format=raw,readonly=on,file={SHARE}/{CODE}",
            "-drive", f"if=pflash,format=raw,file={work}/vars.fd", *drives,
            "-display", "none", "-serial", f"unix:{self.sock_path},server=on,wait=off",
            "-monitor", f"unix:{work}/monitor.sock,server=on,wait=off"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                self.sock = socket.socket(socket.AF_UNIX)
                self.sock.connect(self.sock_path)
                break
            except OSError:
                time.sleep(0.1)
        self.sock.settimeout(1)
        self.seen = ""
        self.work = work

    def expect(self, text, timeout):
        """Waits until `text` appears in what the machine printed after the last `expect`."""
        deadline = time.time() + timeout * SLOW
        while time.time() < deadline:
            if text in self.seen:
                before, _, self.seen = self.seen.partition(text)
                return before
            try:
                chunk = self.sock.recv(65536).decode(errors="replace")
                sys.stdout.write(chunk)
                sys.stdout.flush()
                self.seen += chunk
            except socket.timeout:
                pass
        self.screenshot()
        raise SystemExit(f"FAIL: never saw {text!r}; the screen is in {self.work}/screen.ppm")

    def screenshot(self):
        """Saves the machine's screen, to see what it shows when the serial port is silent."""
        mon = socket.socket(socket.AF_UNIX)
        mon.connect(f"{self.work}/monitor.sock")
        mon.sendall(f"screendump {self.work}/screen.ppm\n".encode())
        time.sleep(2)
        mon.close()

    def send(self, line):
        """Types one line and Enter."""
        time.sleep(0.5)
        self.sock.sendall(line.encode() + b"\r")

    def stop(self):
        """Powers the machine off."""
        self.qemu.kill()
        self.qemu.wait()


def target_is_blank(work):
    """True if the guest has written nothing at all to the target disk."""
    out = subprocess.run(["qemu-img", "map", "-U", "--output=json", f"{work}/target.qcow2"],
                         capture_output=True, text=True, check=True).stdout
    return '"data": true' not in out


def target_sha(work, size):
    """SHA-256 of the target disk's first `size` bytes."""
    raw = f"{work}/target.raw"
    subprocess.run(["qemu-img", "convert", "-O", "raw", f"{work}/target.qcow2", raw], check=True)
    digest = hashlib.sha256()
    with open(raw, "rb") as f:
        left = size
        while left:
            block = f.read(min(left, 1 << 22))
            digest.update(block)
            left -= len(block)
    os.remove(raw)
    return digest.hexdigest()


def main():
    """Runs the five steps above; exits non-zero on the first failure."""
    work = tempfile.mkdtemp(prefix="mb-installer-test-")
    shutil.copy(f"{SHARE}/{VARS}", f"{work}/vars.fd")
    subprocess.run(["qemu-img", "create", "-q", "-f", "qcow2", f"{work}/target.qcow2", f"{BLANK_DISK_GB}G"], check=True)
    vm = Machine(work, with_stick=True)
    try:
        listing = vm.expect("Type the name of the disk", 600)
        disks = listing.rpartition("Disks on this machine:")[2]
        assert f"  {TARGET} " in disks, "FAIL: the blank disk is not offered"
        assert "  sda " not in disks, "FAIL: the installer stick is offered"
        print("\nPASS: blank disk offered, installer stick not offered")
        vm.send("sda")
        vm.expect("That is the installer itself", 30)
        print("\nPASS: typing the stick's own name is refused")
        vm.expect("Type the name of the disk", 30)
        vm.send(TARGET)
        vm.expect(f"type ERASE {TARGET}", 30)
        vm.send("yes")
        vm.expect("Not erased. Nothing was written.", 30)
        time.sleep(2)
        assert target_is_blank(work), "FAIL: the disk was written without ERASE"
        print("\nPASS: a wrong answer writes nothing (target still blank on the host)")
        vm.expect("Type the name of the disk", 30)
        vm.send(TARGET)
        vm.expect(f"type ERASE {TARGET}", 30)
        vm.send(f"ERASE {TARGET}")
        vm.expect("Installed and checked", 1200)
        vm.expect("Restarting in", 30)
        vm.expect("reboot", 120)
        print("\nPASS: written, checked by the installer, restarting")
    finally:
        vm.stop()
    size = os.path.getsize(RAW)
    with open(RAW, "rb") as f:
        want = hashlib.file_digest(f, "sha256").hexdigest()
    got = target_sha(work, size)
    assert got == want, f"FAIL: target holds {got}, image is {want}"
    print(f"PASS: target's first {size} bytes are the image (sha256 {want})")
    vm = Machine(work, with_stick=False)
    try:
        # The debug image's root shell on the serial port. Nothing is typed before it shows: a key reaching
        # the firmware or the boot loader opens its menu. Then ask where / came from.
        vm.expect("root@", 900)
        vm.send("findmnt -no SOURCE,PARTLABEL / ; lsblk -no PARTLABEL /dev/vda ; echo DONE-$((6*7))")
        vm.expect("DONE-42", 300)
        print("\nPASS: the installed disk boots on its own")
    finally:
        vm.stop()
    shutil.rmtree(work)


main()
