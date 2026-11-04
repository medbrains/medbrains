#!/usr/bin/env python3
"""Drives a booted debug image with real input: the same QMP keyboard and tablet a person's
devices arrive through, plus the serial root shell to check what the screen claims.

  OS_WORK=/tmp/mb-osimage-shell os/tests/vm.py shot out.png | key ctrl c | type TEXT
      | click X Y | drag X1 Y1 X2 Y2 | sh 'command' | cable on|off | reset

Under Apple Virtualization only `sh` works, and needs OS_SERIAL=<the path utm-run.sh prints>.
"""
import json, os, re, select, socket, sys, termios, time, tty

VM = os.environ.get("OS_WORK", "/tmp/mb-osimage") + "/vm"
W, H = int(os.environ.get("OS_SCREEN_W", 1280)), int(os.environ.get("OS_SCREEN_H", 800))
SHIFTED = {"!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8",
           "(": "9", ")": "0", "_": "minus", "+": "equal"}
NAMED = {"-": "minus", "=": "equal", ".": "dot", ",": "comma", "/": "slash", " ": "spc"}


class Qmp:
    """One QMP session."""

    def __init__(self):
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.connect(f"{VM}/qmp.sock")
        self.file = self.sock.makefile("rw")
        self.file.readline()
        self.cmd("qmp_capabilities")

    def cmd(self, command, **arguments):
        """Runs a command and returns its answer, skipping events."""
        self.file.write(json.dumps({"execute": command, "arguments": arguments}) + "\n")
        self.file.flush()
        while True:
            answer = json.loads(self.file.readline())
            if "return" in answer or "error" in answer:
                return answer

    def key(self, *keys):
        """Presses keys together."""
        self.cmd("send-key", keys=[{"type": "qcode", "data": k} for k in keys])
        time.sleep(0.12)

    def type(self, text):
        """Types text one key at a time."""
        for c in text:
            if c.isupper():
                self.key("shift", c.lower())
            elif c in SHIFTED:
                self.key("shift", SHIFTED[c])
            elif c in NAMED:
                self.key(NAMED[c])
            else:
                self.key(c)

    def move(self, x, y):
        """Moves the tablet to a screen position."""
        self.cmd("input-send-event", events=[
            {"type": "abs", "data": {"axis": "x", "value": x * 32767 // W}},
            {"type": "abs", "data": {"axis": "y", "value": y * 32767 // H}}])
        time.sleep(0.15)

    def button(self, down):
        """Presses or releases the left button."""
        self.cmd("input-send-event", events=[{"type": "btn", "data": {"down": down, "button": "left"}}])
        time.sleep(0.08)

    def click(self, x, y):
        """Clicks at a screen position."""
        self.move(x, y)
        self.button(True)
        self.button(False)

    def drag(self, x1, y1, x2, y2):
        """Drags in steps, as a hand does, so a selection really extends."""
        self.move(x1, y1)
        self.button(True)
        for i in range(1, 9):
            self.move(x1 + (x2 - x1) * i // 8, y1 + (y2 - y1) * i // 8)
        self.button(False)


def open_serial():
    """Opens the shell's port: a pty under Apple Virtualization, QEMU's socket otherwise."""
    path = os.environ.get("OS_SERIAL")
    if path:
        fd = os.open(path, os.O_RDWR | os.O_NOCTTY)
        tty.setraw(fd, termios.TCSANOW)
        return fd
    sock = socket.socket(socket.AF_UNIX)
    sock.connect(f"{VM}/serial.sock")
    return os.dup(sock.fileno())


def serial(command, timeout=30):
    """Runs a command in the serial root shell and returns what it printed."""
    fd = open_serial()
    end = f"END{int(time.time() * 1000)}"
    os.write(fd, f"\n{command}; echo {end}$((1+1))\n".encode())
    seen, deadline = b"", time.time() + timeout
    while time.time() < deadline and f"{end}2".encode() not in seen:
        if select.select([fd], [], [], 1)[0]:
            seen += os.read(fd, 65536)
    text = re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", seen.decode(errors="replace"))
    body = text.split(f"{end}$((1+1))", 1)[-1]
    return body.split(f"{end}2", 1)[0].strip()


def main(op, *args):
    """Runs one command-line operation."""
    if op == "sh":
        print(serial(args[0], int(args[1]) if len(args) > 1 else 30))
        return
    qmp = Qmp()
    if op == "shot":
        print(qmp.cmd("human-monitor-command", **{"command-line": f"screendump {args[0]} -f png"}))
    elif op == "key":
        qmp.key(*args)
    elif op == "type":
        qmp.type(args[0])
    elif op == "click":
        qmp.click(int(args[0]), int(args[1]))
    elif op == "drag":
        qmp.drag(*map(int, args))
    elif op == "cable":
        print(qmp.cmd("set_link", name="net0", up=args[0] == "on"))
    elif op == "reset":
        print(qmp.cmd("system_reset"))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(*sys.argv[1:])
