//! One machine under test: a serial shell for inside, forwarded ports for outside, and its power cord.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const BOOT_TIMEOUT: Duration = Duration::from_secs(180);
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(90);
/// Printed by the firmware on every start.
const FIRMWARE_LINE: &str = "BdsDxe";
/// The debug shell's prompt.
const PROMPT: &str = "root@medbrains";
const POLL: Duration = Duration::from_secs(2);
/// Guest ports reachable through QEMU, as host name and guest port.
const FORWARDS: [(&str, u16); 6] = [
    ("web", 443),
    ("http", 80),
    ("ssh", 22),
    ("server", 3000),
    ("database", 5432),
    ("edge", 7811),
];

/// `limit`, stretched for how slow this platform is: not at all here.
pub(crate) const fn scaled(limit: Duration) -> Duration {
    limit
}

/// The machine's own TPM, as a folder name.
pub(crate) const OWN_TPM: &str = "tpm-own";

/// True if this platform's guest can use a TPM, so sealed-disk scenarios can run. Not on this one:
/// Debian's arm64 kernel has no driver for the only TPM QEMU can give it (`OS-KEYS.md`).
pub(crate) const fn tpm_usable() -> bool {
    false
}

/// A running QEMU machine on a throwaway overlay. Dropping it stops it and removes the disk.
pub(crate) struct Vm {
    dir: PathBuf,
    disk: PathBuf,
    ports: Vec<(&'static str, u16)>,
    qemu: Child,
    serial: UnixStream,
    monitor: UnixStream,
    marker: u32,
}

/// A port nothing on this host is using.
fn free_port() -> std::io::Result<u16> {
    Ok(TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

/// Removes terminal colour and cursor codes, and carriage returns.
pub(crate) fn strip_terminal_codes(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            for code in chars.by_ref() {
                if code.is_ascii_alphabetic() {
                    break;
                }
            }
        } else if c != '\r' {
            out.push(c);
        }
    }
    out
}

/// The text between the two marker lines, once both have arrived. The echoed command line is
/// skipped because a marker counts only when it fills its whole line.
pub(crate) fn between_markers(text: &str, begin: &str, end: &str) -> Option<String> {
    let mut lines = text.lines().skip_while(|line| *line != begin);
    lines.next()?;
    let mut found = Vec::new();
    for line in lines {
        if line == end {
            return Some(found.join("\n").trim().to_owned());
        }
        found.push(line);
    }
    None
}

impl Vm {
    /// Boots `image` on a new overlay and waits for a shell.
    pub(crate) fn start(image: &Path) -> Result<Self, String> {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis();
        let dir = std::env::temp_dir().join(format!("mb-os-test-{stamp}"));
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let mut ports = Vec::new();
        for (name, _) in FORWARDS {
            ports.push((name, free_port().map_err(|e| e.to_string())?));
        }
        let share = qemu_share()?;
        std::fs::copy(share.join("edk2-arm-vars.fd"), dir.join("vars.fd"))
            .map_err(|e| e.to_string())?;
        let disk = dir.join("disk.qcow2");
        make_overlay(image, &disk)?;
        let qemu = spawn_qemu(&dir, &disk, &ports)?;
        let serial = connect_socket(&dir.join("serial.sock"))?;
        let monitor = connect_socket(&dir.join("monitor.sock"))?;
        let mut vm = Self {
            dir,
            disk,
            ports,
            qemu,
            serial,
            monitor,
            marker: 0,
        };
        vm.wait_for_shell()?;
        Ok(vm)
    }

    /// The overlay this machine was created with.
    pub(crate) fn disk(&self) -> PathBuf {
        self.disk.clone()
    }

    /// A path for a throwaway file next to the machine's disk.
    pub(crate) fn scratch_path(&self, name: &str) -> PathBuf {
        self.dir.join(name)
    }

    /// Stops the machine the way a pulled plug does.
    pub(crate) fn cut_power(&mut self) -> Result<(), String> {
        self.qemu.kill().map_err(|e| e.to_string())?;
        self.qemu.wait().map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Shuts the machine down cleanly, which also flushes its disk.
    pub(crate) fn shut_down(&mut self) -> Result<(), String> {
        self.serial
            .write_all(b"systemctl poweroff\n")
            .map_err(|e| e.to_string())?;
        let deadline = Instant::now() + SHUTDOWN_TIMEOUT;
        while Instant::now() < deadline {
            if self.qemu.try_wait().map_err(|e| e.to_string())?.is_some() {
                return Ok(());
            }
            sleep(POLL);
        }
        Err("the machine did not turn off".to_owned())
    }

    /// Powers on again from `disk`; the machine must already be off. Returns once QEMU is running, so
    /// a machine that never gives a shell can still be watched. No TPM on this platform.
    pub(crate) fn power_on(&mut self, disk: &Path, _tpm: Option<&str>) -> Result<(), String> {
        self.qemu = spawn_qemu(&self.dir, disk, &self.ports)?;
        self.serial = connect_socket(&self.dir.join("serial.sock"))?;
        self.monitor = connect_socket(&self.dir.join("monitor.sock"))?;
        Ok(())
    }

    /// Powers on again from `disk` and waits for a shell.
    pub(crate) fn boot(&mut self, disk: &Path, tpm: Option<&str>) -> Result<(), String> {
        self.power_on(disk, tpm)?;
        self.wait_for_shell()
    }

    /// Restarts from inside and waits for the shell to come back.
    pub(crate) fn reboot(&mut self) -> Result<(), String> {
        self.serial
            .write_all(b"systemctl reboot\n")
            .map_err(|e| e.to_string())?;
        self.wait_for_restart(BOOT_TIMEOUT)
    }

    /// Gives a command to QEMU's monitor, such as plugging in a USB stick.
    pub(crate) fn monitor(&mut self, command: &str) -> Result<(), String> {
        self.monitor
            .write_all(format!("{command}\n").as_bytes())
            .map_err(|e| e.to_string())?;
        sleep(Duration::from_millis(500));
        // Only QEMU's echo, which nothing reads: drained so its buffer never fills.
        drop(self.monitor.read(&mut [0_u8; 4096]));
        Ok(())
    }

    /// Waits until a command comes back through the serial shell, sending nothing until the shell has
    /// shown its prompt: with two boot entries, a key arriving at the boot loader opens its menu, and
    /// the machine then waits there for a person.
    fn wait_for_shell(&mut self) -> Result<(), String> {
        self.watch_serial(BOOT_TIMEOUT, false)?;
        let deadline = Instant::now() + BOOT_TIMEOUT;
        while Instant::now() < deadline {
            if self
                .run_for("echo ready", Duration::from_secs(4))
                .is_ok_and(|o| o.contains("ready"))
            {
                return Ok(());
            }
            sleep(POLL);
        }
        Err("the machine gave no shell".to_owned())
    }

    /// Reads the serial port, sending nothing, until the shell's prompt appears; after the firmware's
    /// next message if `restarting`, which an old prompt can't satisfy.
    fn watch_serial(&mut self, limit: Duration, restarting: bool) -> Result<(), String> {
        let (mut raw, mut buffer, deadline) = (Vec::new(), [0_u8; 16_384], Instant::now() + limit);
        while Instant::now() < deadline {
            if let Ok(count) = self.serial.read(&mut buffer) {
                raw.extend_from_slice(buffer.get(..count).unwrap_or_default());
            }
            let text = String::from_utf8_lossy(&raw);
            let shown = if restarting {
                text.rfind(FIRMWARE_LINE).map(|at| &text[at..])
            } else {
                Some(&*text)
            };
            if shown.is_some_and(|tail| tail.contains(PROMPT)) {
                return Ok(());
            }
        }
        Err("the machine showed no prompt in time".to_owned())
    }

    /// Waits, sending nothing, for the machine to restart and show a shell.
    pub(crate) fn wait_for_restart(&mut self, limit: Duration) -> Result<(), String> {
        self.watch_serial(limit, true)
    }

    /// Runs a command inside the machine with the usual time limit.
    pub(crate) fn run(&mut self, command: &str) -> Result<String, String> {
        self.run_for(command, Duration::from_secs(30))
    }

    /// Runs a command inside the machine and returns its output.
    pub(crate) fn run_for(&mut self, command: &str, limit: Duration) -> Result<String, String> {
        self.marker += 1;
        let (begin, end) = (
            format!("BEGIN{}X", self.marker),
            format!("END{}X", self.marker),
        );
        // The bare `echo` ends a last line with no newline, which would hide the marker.
        let line = format!("echo {begin}; {command}; echo; echo {end}\n");
        self.serial
            .write_all(line.as_bytes())
            .map_err(|e| e.to_string())?;
        let (mut raw, mut buffer, deadline) = (Vec::new(), [0_u8; 16_384], Instant::now() + limit);
        while Instant::now() < deadline {
            if let Ok(count) = self.serial.read(&mut buffer) {
                raw.extend_from_slice(buffer.get(..count).unwrap_or_default());
            }
            let text = strip_terminal_codes(&String::from_utf8_lossy(&raw));
            if let Some(found) = between_markers(&text, &begin, &end) {
                return Ok(found);
            }
        }
        Err(format!("no answer from: {command}"))
    }

    /// The host port forwarded to a named guest port.
    pub(crate) fn port(&self, name: &str) -> Result<u16, String> {
        self.ports
            .iter()
            .find(|(n, _)| *n == name)
            .map(|(_, p)| *p)
            .ok_or_else(|| format!("no port {name}"))
    }

    /// HTTP status from outside the machine; 0 if nothing answered.
    pub(crate) fn status(&self, name: &str, scheme: &str, path: &str) -> Result<u16, String> {
        let url = format!("{scheme}://127.0.0.1:{}{path}", self.port(name)?);
        let done = Command::new("curl")
            .args([
                "-sk",
                "-m",
                "8",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                &url,
            ])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(String::from_utf8_lossy(&done.stdout)
            .trim()
            .parse()
            .unwrap_or(0))
    }

    /// True if a guest port answers or refuses. QEMU accepts the connection itself, so packets
    /// the firewall drops leave it silent, while a closed port ends it at once.
    pub(crate) fn reachable(&self, name: &str) -> Result<bool, String> {
        let mut client =
            TcpStream::connect(("127.0.0.1", self.port(name)?)).map_err(|e| e.to_string())?;
        client
            .set_read_timeout(Some(Duration::from_secs(4)))
            .map_err(|e| e.to_string())?;
        let mut byte = [0_u8; 16];
        Ok(
            !matches!(client.read(&mut byte), Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut)),
        )
    }

    /// Waits for the server to answer through the front proxy.
    pub(crate) fn wait_for_server(&self) -> Result<(), String> {
        let deadline = Instant::now() + BOOT_TIMEOUT;
        while Instant::now() < deadline {
            if self.status("web", "https", "/api/health")? == 200 {
                return Ok(());
            }
            sleep(POLL);
        }
        Err("the server never answered".to_owned())
    }
}

impl Drop for Vm {
    fn drop(&mut self) {
        // Best effort: the process is ending and these are throwaway files.
        drop(self.qemu.kill());
        drop(self.qemu.wait());
        drop(std::fs::remove_dir_all(&self.dir));
    }
}

/// Creates an overlay on `image`, so the image itself is never written. `image` may be raw or qcow2.
pub(crate) fn make_overlay(image: &Path, overlay: &Path) -> Result<(), String> {
    let format = if image.extension().is_some_and(|e| e == "qcow2") {
        "qcow2"
    } else {
        "raw"
    };
    let made = Command::new("qemu-img")
        .args(["create", "-q", "-f", "qcow2", "-F", format, "-b"])
        .arg(image)
        .arg(overlay)
        .arg("32G")
        .status()
        .map_err(|e| e.to_string())?;
    if made.success() {
        Ok(())
    } else {
        Err("could not create the overlay".to_owned())
    }
}

/// Starts QEMU from `disk`, with its serial port and monitor on sockets in `dir`.
fn spawn_qemu(dir: &Path, disk: &Path, ports: &[(&str, u16)]) -> Result<Child, String> {
    let share = qemu_share()?;
    let forwards: Vec<String> = ports
        .iter()
        .zip(FORWARDS)
        .map(|((_, host), (_, guest))| format!("hostfwd=tcp:127.0.0.1:{host}-:{guest}"))
        .collect();
    let accel = if cfg!(target_os = "macos") {
        "hvf"
    } else {
        "kvm"
    };
    Command::new("qemu-system-aarch64")
        .args([
            "-machine", "virt", "-accel", accel, "-cpu", "host", "-smp", "4", "-m", "4096",
            "-device", "i6300esb",
        ])
        .arg("-drive")
        .arg(format!(
            "if=pflash,format=raw,readonly=on,file={}",
            share.join("edk2-aarch64-code.fd").display()
        ))
        .arg("-drive")
        .arg(format!(
            "if=pflash,format=raw,file={}",
            dir.join("vars.fd").display()
        ))
        .arg("-drive")
        .arg(format!("if=virtio,format=qcow2,file={}", disk.display()))
        .args([
            "-device",
            "virtio-gpu-pci,xres=1280,yres=800",
            "-device",
            "qemu-xhci",
            "-device",
            "usb-kbd",
            "-device",
            "usb-tablet",
        ])
        .arg("-netdev")
        .arg(format!("user,id=net0,{}", forwards.join(",")))
        .args(["-device", "virtio-net-pci,netdev=net0", "-display", "none"])
        .arg("-serial")
        .arg(format!(
            "unix:{},server,nowait",
            dir.join("serial.sock").display()
        ))
        .arg("-monitor")
        .arg(format!(
            "unix:{},server,nowait",
            dir.join("monitor.sock").display()
        ))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start QEMU: {e}"))
}

/// QEMU's firmware folder, found from where its binary lives.
fn qemu_share() -> Result<PathBuf, String> {
    let found = Command::new("sh")
        .args(["-c", "command -v qemu-system-aarch64"])
        .output()
        .map_err(|e| e.to_string())?;
    let binary = PathBuf::from(String::from_utf8_lossy(&found.stdout).trim());
    let real = std::fs::canonicalize(&binary).map_err(|e| format!("QEMU not found: {e}"))?;
    real.ancestors()
        .nth(2)
        .map(|root| root.join("share/qemu"))
        .ok_or_else(|| "odd QEMU path".to_owned())
}

/// Connects to one of QEMU's sockets, which it creates shortly after starting.
fn connect_socket(path: &Path) -> Result<UnixStream, String> {
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        match UnixStream::connect(path) {
            Ok(stream) => {
                stream
                    .set_read_timeout(Some(Duration::from_millis(300)))
                    .map_err(|e| e.to_string())?;
                return Ok(stream);
            }
            Err(e) if Instant::now() > deadline => {
                return Err(format!("no socket {}: {e}", path.display()));
            }
            Err(_) => sleep(Duration::from_millis(200)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{between_markers, strip_terminal_codes};

    #[test]
    fn output_is_read_only_between_whole_line_markers() {
        // The shell echoes the command, which also contains the markers: that must not count.
        let text = "echo B1X; ls; echo; echo E1X\nB1X\none\ntwo\n\nE1X\nroot#";
        assert_eq!(
            between_markers(text, "B1X", "E1X").as_deref(),
            Some("one\ntwo")
        );
        assert_eq!(between_markers("B1X\nstill running", "B1X", "E1X"), None);
    }

    #[test]
    fn terminal_codes_do_not_reach_the_checks() {
        assert_eq!(strip_terminal_codes("\u{1b}[?2004hok\r\n\u{1b}[0m"), "ok\n");
    }
}
