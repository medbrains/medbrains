#!/usr/bin/env python3
"""Proves the installer .iso in QEMU, through its serial console, the way an operator would use it:

  0. a stick with one byte of its image changed is refused before any disk is offered, and writes nothing;
  1. it boots from the ISO attached as a USB stick, next to one blank disk;
  2. the stick is not offered, and typing its name is refused;
  2b. a disk swapped (hot-unplugged, another plugged in its place) after it was named is refused, and
      neither disk is written;
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

    def __init__(self, work, with_stick, iso=ISO):
        self.sock_path = os.path.join(work, "serial.sock")
        # The target sits behind its own PCIe root port so it can be hot-unplugged; two spare ports take the
        # disk swapped in and the original plugged back.
        drives = ["-device", "pcie-root-port,id=rp1,chassis=1", "-device", "pcie-root-port,id=rp2,chassis=2",
                  "-device", "pcie-root-port,id=rp3,chassis=3",
                  "-drive", f"if=none,id=t0,format=qcow2,file={work}/target.qcow2",
                  "-device", "virtio-blk-pci,drive=t0,id=tdev,bus=rp1,serial=MBTARGET1"]
        if with_stick:
            # snapshot=on: the stick looks writable to the guest, as a real one does, and stays untouched.
            drives += ["-device", "qemu-xhci", "-drive", f"if=none,id=stick,format=raw,snapshot=on,file={iso}",
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

    def hmp(self, command):
        """Runs one QEMU monitor command and returns what it printed."""
        mon = socket.socket(socket.AF_UNIX)
        mon.connect(f"{self.work}/monitor.sock")
        mon.settimeout(2)
        mon.sendall(command.encode() + b"\n")
        out = b""
        try:
            while True:
                chunk = mon.recv(65536)
                if not chunk:
                    break
                out += chunk
        except socket.timeout:
            pass
        mon.close()
        return out.decode(errors="replace")

    def unplug(self, device, drive):
        """Hot-unplugs a disk and waits until the guest has let it go."""
        self.hmp(f"device_del {device}")
        deadline = time.time() + 120 * SLOW
        while f"{drive} (" in self.hmp("info block"):
            if time.time() > deadline:
                raise SystemExit(f"FAIL: {device} never unplugged")
            time.sleep(2)

    def plug(self, drive, path, device, port, serial):
        """Hot-plugs a disk with a given serial, then gives the guest time to see it."""
        self.hmp(f"drive_add 0 if=none,id={drive},format=qcow2,file={path}")
        self.hmp(f"device_add virtio-blk-pci,drive={drive},id={device},bus={port},serial={serial}")
        time.sleep(15 * SLOW)

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


def target_is_blank(work, name="target.qcow2"):
    """True if the guest has written nothing at all to this disk."""
    out = subprocess.run(["qemu-img", "map", "-U", "--output=json", f"{work}/{name}"],
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


def corrupt_copy(work):
    """A copy of the ISO with one byte of its system image flipped, 16 MiB into the compressed file."""
    bad = f"{work}/corrupt.iso"
    subprocess.run(["cp", "-c" if sys.platform == "darwin" else "--reflink=auto", ISO, bad], check=True)
    with open(bad, "r+b") as f:
        data = f.read(64 << 20)
        # The image is the first zstd frame on the ISO: the boot file sits in the EFI partition after it.
        start = data.index(b"\x28\xb5\x2f\xfd")
        f.seek(start + (16 << 20))
        byte = f.read(1)
        f.seek(start + (16 << 20))
        f.write(bytes([byte[0] ^ 0xFF]))
    return bad


def damaged_medium_is_refused(work):
    """Step 0: the damaged stick says so, never lists a disk, and the target stays blank."""
    vm = Machine(work, with_stick=True, iso=corrupt_copy(work))
    try:
        before = vm.expect("THE INSTALLER MEDIUM IS DAMAGED", 900)
        assert "Type the name of the disk" not in before, "FAIL: a disk was offered from a damaged medium"
        time.sleep(5)
        assert "Type the name of the disk" not in vm.seen, "FAIL: a disk was offered from a damaged medium"
        assert target_is_blank(work), "FAIL: a damaged medium wrote to the disk"
        print("\nPASS: a damaged medium is refused before any disk is offered; target still blank")
    finally:
        vm.stop()
    os.remove(f"{work}/corrupt.iso")
    shutil.copy(f"{SHARE}/{VARS}", f"{work}/vars.fd")


def main():
    """Runs the five steps above; exits non-zero on the first failure."""
    work = tempfile.mkdtemp(prefix="mb-installer-test-")
    shutil.copy(f"{SHARE}/{VARS}", f"{work}/vars.fd")
    subprocess.run(["qemu-img", "create", "-q", "-f", "qcow2", f"{work}/target.qcow2", f"{BLANK_DISK_GB}G"], check=True)
    damaged_medium_is_refused(work)
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
        # Swap the named disk for another of the same size before confirming: the same name, maybe the same
        # major:minor, but not the same disk.
        subprocess.run(["qemu-img", "create", "-q", "-f", "qcow2", f"{work}/other.qcow2", f"{BLANK_DISK_GB}G"], check=True)
        vm.unplug("tdev", "t0")
        vm.plug("t1", f"{work}/other.qcow2", "tdev2", "rp2", "MBOTHER")
        vm.send(f"ERASE {TARGET}")
        vm.expect("has changed since it was listed", 120)
        vm.expect("Press Enter to go back", 30)
        time.sleep(2)
        assert target_is_blank(work) and target_is_blank(work, "other.qcow2"), "FAIL: a swapped disk was written"
        print("\nPASS: a disk swapped after it was named is refused; neither disk written")
        vm.unplug("tdev2", "t1")
        vm.plug("t2", f"{work}/target.qcow2", "tdev3", "rp3", "MBTARGET1")
        vm.send("")
        vm.expect("Type the name of the disk", 60)
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
