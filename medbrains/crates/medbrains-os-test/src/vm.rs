//! One machine under test: a serial shell for inside, forwarded ports for outside.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const BOOT_TIMEOUT: Duration = Duration::from_secs(180);
const POLL: Duration = Duration::from_secs(2);
/// Guest ports reachable through QEMU, as host name and guest port.
const FORWARDS: [(&str, u16); 6] = [("web", 443), ("http", 80), ("ssh", 22), ("server", 3000), ("database", 5432), ("edge", 7811)];

/// A running QEMU machine on a throwaway overlay. Dropping it stops it and removes the disk.
pub struct Vm {
    dir: PathBuf,
    ports: Vec<(&'static str, u16)>,
    qemu: Child,
    serial: UnixStream,
    marker: u32,
}

/// A port nothing on this host is using.
fn free_port() -> std::io::Result<u16> {
    Ok(TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

/// Removes terminal colour and cursor codes, and carriage returns.
pub fn strip_terminal_codes(text: &str) -> String {
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
pub fn between_markers(text: &str, begin: &str, end: &str) -> Option<String> {
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
    pub fn start(image: &Path) -> Result<Self, String> {
        let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis();
        let dir = std::env::temp_dir().join(format!("mb-os-test-{stamp}"));
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let mut ports = Vec::new();
        for (name, _) in FORWARDS {
            ports.push((name, free_port().map_err(|e| e.to_string())?));
        }
        let qemu = spawn_qemu(&dir, image, &ports)?;
        let serial = connect_serial(&dir)?;
        let mut vm = Self { dir, ports, qemu, serial, marker: 0 };
        vm.wait_for_shell()?;
        Ok(vm)
    }

    /// Waits until a command comes back through the serial shell.
    fn wait_for_shell(&mut self) -> Result<(), String> {
        let deadline = Instant::now() + BOOT_TIMEOUT;
        while Instant::now() < deadline {
            if self.run_for("echo ready", Duration::from_secs(4)).is_ok_and(|o| o.contains("ready")) {
                return Ok(());
            }
            sleep(POLL);
        }
        Err("the machine gave no shell".to_owned())
    }

    /// Runs a command inside the machine with the usual time limit.
    pub fn run(&mut self, command: &str) -> Result<String, String> {
        self.run_for(command, Duration::from_secs(30))
    }

    /// Runs a command inside the machine and returns its output.
    pub fn run_for(&mut self, command: &str, limit: Duration) -> Result<String, String> {
        self.marker += 1;
        let (begin, end) = (format!("BEGIN{}X", self.marker), format!("END{}X", self.marker));
        // The bare `echo` ends a last line with no newline, which would hide the marker.
        let line = format!("echo {begin}; {command}; echo; echo {end}\n");
        self.serial.write_all(line.as_bytes()).map_err(|e| e.to_string())?;
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
    pub fn port(&self, name: &str) -> Result<u16, String> {
        self.ports.iter().find(|(n, _)| *n == name).map(|(_, p)| *p).ok_or_else(|| format!("no port {name}"))
    }

    /// HTTP status from outside the machine; 0 if nothing answered.
    pub fn status(&self, name: &str, scheme: &str, path: &str) -> Result<u16, String> {
        let url = format!("{scheme}://127.0.0.1:{}{path}", self.port(name)?);
        let done = Command::new("curl").args(["-sk", "-m", "8", "-o", "/dev/null", "-w", "%{http_code}", &url]).output().map_err(|e| e.to_string())?;
        Ok(String::from_utf8_lossy(&done.stdout).trim().parse().unwrap_or(0))
    }

    /// True if a guest port answers or refuses. QEMU accepts the connection itself, so packets
    /// the firewall drops leave it silent, while a closed port ends it at once.
    pub fn reachable(&self, name: &str) -> Result<bool, String> {
        let mut client = TcpStream::connect(("127.0.0.1", self.port(name)?)).map_err(|e| e.to_string())?;
        client.set_read_timeout(Some(Duration::from_secs(4))).map_err(|e| e.to_string())?;
        let mut byte = [0_u8; 16];
        Ok(!matches!(client.read(&mut byte), Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut)))
    }

    /// Waits for the server to answer through the front proxy.
    pub fn wait_for_server(&self) -> Result<(), String> {
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

/// Starts QEMU with its serial port on a socket in `dir`.
fn spawn_qemu(dir: &Path, image: &Path, ports: &[(&str, u16)]) -> Result<Child, String> {
    let share = qemu_share()?;
    std::fs::copy(share.join("edk2-arm-vars.fd"), dir.join("vars.fd")).map_err(|e| e.to_string())?;
    let disk = dir.join("disk.qcow2");
    let made = Command::new("qemu-img").args(["create", "-q", "-f", "qcow2", "-F", "raw", "-b"]).arg(image).arg(&disk).arg("32G").status().map_err(|e| e.to_string())?;
    if !made.success() {
        return Err("could not create the overlay".to_owned());
    }
    let forwards: Vec<String> = ports.iter().zip(FORWARDS).map(|((_, host), (_, guest))| format!("hostfwd=tcp:127.0.0.1:{host}-:{guest}")).collect();
    let accel = if cfg!(target_os = "macos") { "hvf" } else { "kvm" };
    Command::new("qemu-system-aarch64")
        .args(["-machine", "virt", "-accel", accel, "-cpu", "host", "-smp", "4", "-m", "4096"])
        .arg("-drive").arg(format!("if=pflash,format=raw,readonly=on,file={}", share.join("edk2-aarch64-code.fd").display()))
        .arg("-drive").arg(format!("if=pflash,format=raw,file={}", dir.join("vars.fd").display()))
        .arg("-drive").arg(format!("if=virtio,format=qcow2,file={}", disk.display()))
        .args(["-device", "virtio-gpu-pci,xres=1280,yres=800", "-device", "qemu-xhci", "-device", "usb-kbd", "-device", "usb-tablet"])
        .arg("-netdev").arg(format!("user,id=net0,{}", forwards.join(",")))
        .args(["-device", "virtio-net-pci,netdev=net0", "-display", "none"])
        .arg("-serial").arg(format!("unix:{},server,nowait", dir.join("serial.sock").display()))
        .stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().map_err(|e| format!("could not start QEMU: {e}"))
}

/// QEMU's firmware folder, found from where its binary lives.
fn qemu_share() -> Result<PathBuf, String> {
    let found = Command::new("sh").args(["-c", "command -v qemu-system-aarch64"]).output().map_err(|e| e.to_string())?;
    let binary = PathBuf::from(String::from_utf8_lossy(&found.stdout).trim());
    let real = std::fs::canonicalize(&binary).map_err(|e| format!("QEMU not found: {e}"))?;
    real.ancestors().nth(2).map(|root| root.join("share/qemu")).ok_or_else(|| "odd QEMU path".to_owned())
}

/// Connects to the serial socket, which QEMU creates shortly after starting.
fn connect_serial(dir: &Path) -> Result<UnixStream, String> {
    let deadline = Instant::now() + Duration::from_secs(20);
    loop {
        match UnixStream::connect(dir.join("serial.sock")) {
            Ok(stream) => {
                stream.set_read_timeout(Some(Duration::from_millis(300))).map_err(|e| e.to_string())?;
                return Ok(stream);
            }
            Err(e) if Instant::now() > deadline => return Err(format!("no serial port: {e}")),
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
        assert_eq!(between_markers(text, "B1X", "E1X").as_deref(), Some("one\ntwo"));
        assert_eq!(between_markers("B1X\nstill running", "B1X", "E1X"), None);
    }

    #[test]
    fn terminal_codes_do_not_reach_the_checks() {
        assert_eq!(strip_terminal_codes("\u{1b}[?2004hok\r\n\u{1b}[0m"), "ok\n");
    }
}
