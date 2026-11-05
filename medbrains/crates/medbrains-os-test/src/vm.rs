//! One machine under test: a serial shell for inside, forwarded ports for outside, a software TPM
//! and a keyboard. A TPM is one folder: another folder is another chip.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const BOOT_TIMEOUT: Duration = Duration::from_secs(180);
const COMMAND_TIMEOUT: Duration = Duration::from_secs(30);
const BOOT_ID: &str = "cat /proc/sys/kernel/random/boot_id";
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

/// What differs between the architectures an image can be tested on.
struct Platform {
    qemu: &'static str,
    machine: [&'static str; 8],
    code: &'static str,
    vars: &'static str,
    tpm_device: &'static str,
    extra_devices: [&'static str; 2],
    /// False where the guest kernel cannot drive any TPM QEMU can offer: Debian's arm64 kernel has no
    /// MMIO TIS driver (`CONFIG_TCG_TIS` is off) and QEMU has no other TPM for `virt`. Tested on x86-64.
    has_usable_tpm: bool,
    /// Limits are scaled by this: x86-64 on an Apple-silicon host is emulated.
    slowness: u32,
    /// How long to send nothing after power on: text on the serial port during x86 firmware opens
    /// its setup menu, and the machine then never boots.
    firmware: Duration,
}

const ARM64: Platform = Platform {
    qemu: "qemu-system-aarch64",
    machine: [
        "-machine",
        "virt",
        "-accel",
        if cfg!(target_os = "macos") {
            "hvf"
        } else {
            "kvm"
        },
        "-cpu",
        "host",
        "-smp",
        "4",
    ],
    code: "edk2-aarch64-code.fd",
    vars: "edk2-arm-vars.fd",
    tpm_device: "tpm-tis-device,tpmdev=tpm0,ppi=off",
    extra_devices: ["-device", "i6300esb"],
    has_usable_tpm: false,
    slowness: 1,
    firmware: Duration::ZERO,
};

const X86_64: Platform = Platform {
    qemu: "qemu-system-x86_64",
    machine: [
        "-machine",
        "q35",
        "-accel",
        "tcg,thread=multi",
        "-cpu",
        "max",
        "-smp",
        "4",
    ],
    code: "edk2-x86_64-code.fd",
    vars: "edk2-i386-vars.fd",
    tpm_device: "tpm-tis,tpmdev=tpm0",
    extra_devices: ["-device", "i6300esb"],
    has_usable_tpm: true,
    slowness: 8,
    firmware: Duration::from_secs(45),
};

/// The platform to test: arm64, or x86-64 when `MB_OS_TEST_ARCH=x86-64`.
fn platform() -> &'static Platform {
    if std::env::var("MB_OS_TEST_ARCH").as_deref() == Ok("x86-64") {
        &X86_64
    } else {
        &ARM64
    }
}

/// True if this platform's guest can use a TPM, so sealed-disk scenarios can run.
pub(crate) fn tpm_usable() -> bool {
    platform().has_usable_tpm
}

/// `limit`, stretched for how slow this platform is.
pub(crate) fn scaled(limit: Duration) -> Duration {
    limit * platform().slowness
}

/// The machine's own TPM, as a folder name.
pub(crate) const OWN_TPM: &str = "tpm-own";
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(90);
const KEY_GAP: Duration = Duration::from_millis(60);
const RECOVERY_KEY_GROUPS: usize = 8;
/// The question can reach the screen before the USB keyboard works, and keys sent then are lost.
pub(crate) const KEYBOARD_READY: Duration = Duration::from_secs(10);
const RECOVERY_KEY_PROMPT: &str = "write down this disk's recovery key";
const START_QUESTION: &str = "how should this machine start";
/// What setup says on a machine with no TPM.
pub(crate) const NO_TPM_QUESTION: &str = "no security chip";

/// A running QEMU machine on a throwaway overlay. Dropping it stops it and removes the disk.
pub(crate) struct Vm {
    dir: PathBuf,
    disk: PathBuf,
    ports: Vec<(&'static str, u16)>,
    qemu: Child,
    serial: UnixStream,
    monitor: UnixStream,
    marker: u32,
    /// The recovery key shown on the screen at first boot, once confirmed.
    pub(crate) recovery_key: String,
}

/// A recovery key in screen text: eight dash-separated lowercase groups.
pub(crate) fn find_recovery_key(screen: &str) -> Option<String> {
    screen.split_whitespace().find_map(|word| {
        let groups: Vec<&str> = word.split('-').collect();
        let shaped = groups.len() == RECOVERY_KEY_GROUPS
            && groups
                .iter()
                .all(|g| !g.is_empty() && g.chars().all(|c| c.is_ascii_lowercase()));
        shaped.then(|| word.to_owned())
    })
}

/// The last group of a recovery key, which the setup screen asks to have typed back.
fn last_group(key: &str) -> &str {
    key.rsplit('-').next().unwrap_or(key)
}

/// QEMU's name for the key that types `c`, if it has one.
fn qemu_key(c: char) -> Option<String> {
    match c {
        '-' => Some("minus".to_owned()),
        ' ' => Some("spc".to_owned()),
        '\n' => Some("ret".to_owned()),
        c if c.is_ascii_uppercase() => Some(format!("shift-{}", c.to_ascii_lowercase())),
        c if c.is_ascii_lowercase() || c.is_ascii_digit() => Some(c.to_string()),
        _ => None,
    }
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
    /// Boots `image` as a new machine and answers setup's question on its screen: confirms the recovery
    /// key where a TPM works, and otherwise types the choice to store data unencrypted.
    pub(crate) fn start(image: &Path) -> Result<Self, String> {
        let mut vm = Self::start_answering_key(image)?;
        if tpm_usable() {
            vm.type_text("\n")?;
        }
        Ok(vm)
    }

    /// As `start`, but stops at the question about a PIN where a TPM works.
    pub(crate) fn start_answering_key(image: &Path) -> Result<Self, String> {
        if !tpm_usable() {
            let mut vm = Self::start_waiting(image, None)?;
            vm.wait_for_screen(NO_TPM_QUESTION, scaled(BOOT_TIMEOUT))?;
            sleep(KEYBOARD_READY);
            vm.type_text("STORE UNENCRYPTED\n")?;
            return Ok(vm);
        }
        let mut vm = Self::start_waiting(image, Some(OWN_TPM))?;
        vm.confirm_recovery_key()?;
        Ok(vm)
    }

    /// Boots `image` on a new overlay and waits for a shell; nothing is typed on its screen.
    pub(crate) fn start_waiting(image: &Path, tpm: Option<&str>) -> Result<Self, String> {
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
        std::fs::copy(share.join(platform().vars), dir.join("vars.fd"))
            .map_err(|e| e.to_string())?;
        let disk = dir.join("disk.qcow2");
        let made = Command::new("qemu-img")
            .args(["create", "-q", "-f", "qcow2", "-F", "raw", "-b"])
            .arg(image)
            .arg(&disk)
            .arg("32G")
            .status()
            .map_err(|e| e.to_string())?;
        if !made.success() {
            return Err("could not create the overlay".to_owned());
        }
        let qemu = spawn_qemu(&dir, &disk, &ports, tpm)?;
        let serial = connect_socket(&dir.join("serial.sock"))?;
        let monitor = connect_socket(&dir.join("monitor.sock"))?;
        monitor
            .set_read_timeout(Some(Duration::from_millis(5)))
            .map_err(|e| e.to_string())?;
        let mut vm = Self {
            dir,
            disk,
            ports,
            qemu,
            serial,
            monitor,
            marker: 0,
            recovery_key: String::new(),
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

    /// Waits up to `limit` for the machine to turn itself off.
    pub(crate) fn wait_for_power_off(&mut self, limit: Duration) -> Result<(), String> {
        let deadline = Instant::now() + limit;
        while Instant::now() < deadline {
            if self.qemu.try_wait().map_err(|e| e.to_string())?.is_some() {
                return Ok(());
            }
            sleep(POLL);
        }
        Err("the machine did not turn off".to_owned())
    }

    /// Shuts the machine down cleanly, which also flushes its disk.
    pub(crate) fn shut_down(&mut self) -> Result<(), String> {
        self.serial
            .write_all(b"systemctl poweroff\n")
            .map_err(|e| e.to_string())?;
        self.wait_for_power_off(scaled(SHUTDOWN_TIMEOUT))
    }

    /// Powers on again from `disk` with the TPM in folder `tpm`; the machine must already be off.
    pub(crate) fn boot(&mut self, disk: &Path, tpm: Option<&str>) -> Result<(), String> {
        self.qemu = spawn_qemu(&self.dir, disk, &self.ports, tpm)?;
        self.serial = connect_socket(&self.dir.join("serial.sock"))?;
        self.monitor = connect_socket(&self.dir.join("monitor.sock"))?;
        self.monitor
            .set_read_timeout(Some(Duration::from_millis(5)))
            .map_err(|e| e.to_string())?;
        self.wait_for_shell()
    }

    /// Restarts from inside and waits for the shell to come back.
    pub(crate) fn reboot(&mut self) -> Result<(), String> {
        self.restart_with(
            b"systemctl reboot
",
        )
    }

    /// Restarts a machine waiting at the disk prompt, where systemd has no bus to ask politely on.
    pub(crate) fn force_reboot(&mut self) -> Result<(), String> {
        self.restart_with(
            b"sync; systemctl --force --force reboot
",
        )
    }

    /// Sends a restart command and waits for a new boot. It cannot wait for the command's answer.
    fn restart_with(&mut self, command: &[u8]) -> Result<(), String> {
        // The old shell can answer until it is stopped, so a new boot is known by its boot id.
        let before = self.run(BOOT_ID)?;
        self.serial.write_all(command).map_err(|e| e.to_string())?;
        let deadline = Instant::now() + scaled(BOOT_TIMEOUT);
        while Instant::now() < deadline {
            if self
                .run_for(BOOT_ID, Duration::from_secs(4))
                .is_ok_and(|id| id != before)
            {
                return Ok(());
            }
            sleep(POLL);
        }
        Err("the machine did not come back from a restart".to_owned())
    }

    /// Types `text` on the machine's keyboard. Characters QEMU has no key for are an error.
    pub(crate) fn type_text(&mut self, text: &str) -> Result<(), String> {
        for c in text.chars() {
            let key = qemu_key(c).ok_or_else(|| format!("no key for {c:?}"))?;
            self.monitor
                .write_all(format!("sendkey {key} 30\n").as_bytes())
                .map_err(|e| e.to_string())?;
            sleep(KEY_GAP);
            // Only QEMU's echo, which nothing reads: drained so its buffer never fills.
            drop(self.monitor.read(&mut [0_u8; 4096]));
        }
        Ok(())
    }

    /// The text on the machine's own screen.
    pub(crate) fn screen(&mut self) -> Result<String, String> {
        self.run("cat /dev/vcs1 | tr -s ' '")
    }

    /// Waits for `text` to appear on the machine's own screen.
    pub(crate) fn wait_for_screen(
        &mut self,
        text: &str,
        limit: Duration,
    ) -> Result<String, String> {
        let deadline = Instant::now() + limit;
        while Instant::now() < deadline {
            let shown = self.screen()?;
            if shown.contains(text) {
                return Ok(shown);
            }
            sleep(POLL);
        }
        Err(format!("the screen never said: {text}"))
    }

    /// Reads the recovery key off the screen, without confirming it.
    pub(crate) fn read_recovery_key(&mut self) -> Result<String, String> {
        let shown = self.wait_for_screen(RECOVERY_KEY_PROMPT, scaled(BOOT_TIMEOUT))?;
        find_recovery_key(&shown).ok_or_else(|| "no recovery key on the screen".to_owned())
    }

    /// Reads the recovery key off the screen and types back its last group, as a person does.
    pub(crate) fn confirm_recovery_key(&mut self) -> Result<(), String> {
        let key = self.read_recovery_key()?;
        self.type_text(&format!("{}\n", last_group(&key)))?;
        self.recovery_key = key;
        self.wait_for_screen(START_QUESTION, scaled(COMMAND_TIMEOUT))?;
        Ok(())
    }

    /// Waits until a command comes back through the serial shell.
    fn wait_for_shell(&mut self) -> Result<(), String> {
        sleep(platform().firmware);
        let deadline = Instant::now() + scaled(BOOT_TIMEOUT);
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

    /// Runs a command inside the machine with the usual time limit.
    pub(crate) fn run(&mut self, command: &str) -> Result<String, String> {
        self.run_for(command, scaled(COMMAND_TIMEOUT))
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
        let deadline = Instant::now() + scaled(BOOT_TIMEOUT);
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

/// Starts a software TPM kept in folder `name`, and returns QEMU's arguments for it. It ends when
/// QEMU does, and its state stays in the folder.
fn tpm_args(dir: &Path, name: &str) -> Result<Vec<String>, String> {
    let (state, control) = (dir.join(name), dir.join(format!("{name}.sock")));
    std::fs::create_dir_all(&state).map_err(|e| e.to_string())?;
    let started = Command::new("swtpm")
        .args(["socket", "--tpm2", "--daemon", "--terminate"])
        .arg("--tpmstate")
        .arg(format!("dir={}", state.display()))
        .arg("--ctrl")
        .arg(format!("type=unixio,path={}", control.display()))
        .status()
        .map_err(|e| format!("could not start swtpm (brew install swtpm): {e}"))?;
    if !started.success() {
        return Err("swtpm did not start".to_owned());
    }
    Ok(vec![
        "-chardev".to_owned(),
        format!("socket,id=tpmsock,path={}", control.display()),
        "-tpmdev".to_owned(),
        "emulator,id=tpm0,chardev=tpmsock".to_owned(),
        "-device".to_owned(),
        platform().tpm_device.to_owned(),
    ])
}

/// Starts QEMU from `disk`, with its serial port and monitor on sockets in `dir`.
fn spawn_qemu(
    dir: &Path,
    disk: &Path,
    ports: &[(&str, u16)],
    tpm: Option<&str>,
) -> Result<Child, String> {
    let share = qemu_share()?;
    let tpm = tpm.map_or_else(|| Ok(Vec::new()), |name| tpm_args(dir, name))?;
    let forwards: Vec<String> = ports
        .iter()
        .zip(FORWARDS)
        .map(|((_, host), (_, guest))| format!("hostfwd=tcp:127.0.0.1:{host}-:{guest}"))
        .collect();
    Command::new(platform().qemu)
        .args(platform().machine)
        .args(["-m", "4096"])
        .args(platform().extra_devices)
        .arg("-drive")
        .arg(format!(
            "if=pflash,format=raw,readonly=on,file={}",
            share.join(platform().code).display()
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
        .args(tpm)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start QEMU: {e}"))
}

/// QEMU's firmware folder, found from where its binary lives.
fn qemu_share() -> Result<PathBuf, String> {
    let found = Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {}", platform().qemu))
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
    use super::{between_markers, find_recovery_key, last_group, qemu_key, strip_terminal_codes};

    #[test]
    fn a_recovery_key_is_found_only_in_its_exact_shape() {
        let key = "aa-bb-cc-dd-ee-ff-gg-hh";
        assert_eq!(
            find_recovery_key(&format!("write down\n {key} \nYou need")).as_deref(),
            Some(key)
        );
        assert_eq!(find_recovery_key("a first-boot well-known aa-bb-cc"), None);
        assert_eq!(find_recovery_key("AA-bb-cc-dd-ee-ff-gg-hh"), None);
        assert_eq!(last_group(key), "hh");
    }

    #[test]
    fn typing_names_real_qemu_keys_and_refuses_the_rest() {
        assert_eq!(qemu_key('-').as_deref(), Some("minus"));
        assert_eq!(qemu_key('S').as_deref(), Some("shift-s"));
        assert_eq!(qemu_key('\n').as_deref(), Some("ret"));
        assert_eq!(qemu_key('$'), None);
    }

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
