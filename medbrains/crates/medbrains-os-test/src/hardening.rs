//! Linux hardening (T1.1) and no way in but the screen (X6), checked on a booted machine. Each check
//! tries the attack where a VM can show it, not only reads a setting back.

use std::io::{Read, Write};
use std::path::Path;
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::ensure;
use crate::vm::{self, Vm};

/// One from each group in `medbrains-blocklist.conf`: protocol, file system, DMA, radio, network share.
const BLOCKED_MODULES: [&str; 8] = [
    "dccp",
    "sctp",
    "udf",
    "firewire-core",
    "thunderbolt",
    "bluetooth",
    "cifs",
    "can",
];
const SYSCTLS: [(&str, &str); 17] = [
    ("kernel.io_uring_disabled", "1"),
    ("kernel.io_uring_group", "977"),
    ("kernel.kptr_restrict", "2"),
    ("kernel.dmesg_restrict", "1"),
    ("kernel.kexec_load_disabled", "1"),
    ("kernel.yama.ptrace_scope", "2"),
    ("kernel.unprivileged_bpf_disabled", "1"),
    ("kernel.perf_event_paranoid", "3"),
    ("kernel.core_pattern", "|/bin/false"),
    ("dev.tty.legacy_tiocsti", "0"),
    ("vm.mmap_min_addr", "65536"),
    ("net.core.bpf_jit_harden", "2"),
    ("net.ipv4.conf.all.accept_redirects", "0"),
    ("net.ipv4.conf.all.secure_redirects", "0"),
    ("net.ipv4.ip_forward", "0"),
    ("net.ipv4.tcp_rfc1337", "1"),
    ("net.ipv6.conf.all.accept_ra", "0"),
];
/// On every architecture's command line; the x86-64 extras are checked only there.
const KERNEL_FLAGS: [&str; 10] = [
    "lockdown=confidentiality",
    "module.sig_enforce=1",
    "init_on_alloc=1",
    "init_on_free=1",
    "slab_nomerge",
    "page_alloc.shuffle=1",
    "randomize_kstack_offset=on",
    "debugfs=off",
    "efi_pstore.pstore_disable=1",
    "systemd.getty_auto=no",
];
const X86_FLAGS: [&str; 3] = ["vsyscall=none", "ia32_emulation=0", "iommu=force"];
/// A module Debian signs and nothing here loads: its own copy, signature cut off, must not load.
const PROBE_MODULE: &str = "dummy";
/// Kernel module signature trailer: `struct module_signature` (12 bytes) and the 28-byte marker.
const SIGNATURE_TRAILER: u64 = 40;
const LOGIN_UNITS: [&str; 5] = [
    "getty@tty1.service",
    "serial-getty@ttyAMA0.service",
    "serial-getty@ttyS0.service",
    "autovt@tty2.service",
    "debug-shell.service",
];
/// What a login prompt or a shell would print on the serial port.
const SHELL_SIGNS: [&str; 4] = ["login:", "Password:", "# ", "$ "];
const RELEASE_BOOT: Duration = Duration::from_secs(150);
const SERIAL_LISTEN: Duration = Duration::from_secs(10);

/// Unused kernel modules cannot load.
pub(crate) fn blocked_modules_refuse(vm: &mut Vm, _: &Value) -> Result<(), String> {
    for module in BLOCKED_MODULES {
        let code = vm.run(&format!("modprobe {module} >/dev/null 2>&1; echo $?"))?;
        ensure(code == "1", format!("{module} returned {code}"))?;
    }
    Ok(())
}

/// Kernel hardening settings are applied, as the kernel reports them now.
pub(crate) fn kernel_hardening_applied(vm: &mut Vm, _: &Value) -> Result<(), String> {
    for (name, want) in SYSCTLS {
        let got = vm.run(&format!("sysctl -n {name}"))?;
        ensure(got == want, format!("{name} is {got}"))?;
    }
    Ok(())
}

/// The kernel booted with every hardening flag, and the ones it reports itself are in force.
pub(crate) fn kernel_flags_in_force(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let line = vm.run("cat /proc/cmdline")?;
    let words: Vec<&str> = line.split_whitespace().collect();
    let x86 = vm.run("uname -m")? == "x86_64";
    let extra: &[&str] = if x86 { &X86_FLAGS } else { &[] };
    for flag in KERNEL_FLAGS.iter().chain(extra) {
        ensure(words.contains(flag), format!("{flag} is not on {line}"))?;
    }
    let mode = vm.run("cat /sys/kernel/security/lockdown")?;
    ensure(
        mode.contains("[confidentiality]"),
        format!("lockdown is {mode}"),
    )?;
    let enforced = vm.run("cat /sys/module/module/parameters/sig_enforce")?;
    ensure(enforced == "Y", format!("sig_enforce is {enforced}"))
}

/// Root cannot read kernel memory or mount debugfs: lockdown and debugfs=off, tried for real.
pub(crate) fn kernel_memory_closed_to_root(vm: &mut Vm, _: &Value) -> Result<(), String> {
    for path in ["/proc/kcore", "/dev/mem"] {
        let read = vm.run(&format!(
            "dd if={path} bs=1 count=1 of=/dev/null 2>/dev/null; echo $?"
        ))?;
        ensure(read != "0", format!("root read {path}"))?;
    }
    let mounted = vm.run(
        "d=$(mktemp -d); mount -t debugfs none $d 2>/dev/null; r=$?; umount $d 2>/dev/null; rmdir $d; echo $r",
    )?;
    ensure(mounted != "0", "debugfs mounted")
}

/// A module with its signature cut off is refused, while the same module signed loads: so the
/// refusal is the signature check, not a broken test.
pub(crate) fn unsigned_module_refused(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let found = vm.run(&format!(
        "m=$(find /lib/modules/$(uname -r) -name '{PROBE_MODULE}.ko*' | head -1); case $m in *.xz) xz -dc $m;; *.zst) zstd -dcq $m;; *) cat $m;; esac > /tmp/signed.ko; stat -c %s /tmp/signed.ko"
    ))?;
    let size: u64 = found
        .trim()
        .parse()
        .map_err(|_| format!("no {PROBE_MODULE} module: {found}"))?;
    let length = crate::number(
        vm,
        "tail -c 32 /tmp/signed.ko | head -c 4 | od -An -tu4 --endian=big | tr -d ' '",
    )?;
    let cut = size
        .checked_sub(length + SIGNATURE_TRAILER)
        .ok_or("the module has no signature")?;
    let unsigned = vm.run(&format!(
        "head -c {cut} /tmp/signed.ko > /tmp/unsigned.ko; insmod /tmp/unsigned.ko 2>&1; echo rc=$?"
    ))?;
    let signed = vm.run(&format!(
        "insmod /tmp/signed.ko 2>&1; echo rc=$?; rmmod {PROBE_MODULE}; rm -f /tmp/signed.ko /tmp/unsigned.ko"
    ))?;
    ensure(
        !unsigned.contains("rc=0"),
        format!("an unsigned module loaded: {unsigned}"),
    )?;
    ensure(
        signed.contains("rc=0"),
        format!("the signed module did not load: {signed}"),
    )
}

/// Each `MedBrains` unit's `systemd-analyze security` exposure is within its budget.
pub(crate) fn units_exposure_within_budget(vm: &mut Vm, budgets: &Value) -> Result<(), String> {
    let limits = budgets
        .get("unit_exposure")
        .and_then(Value::as_object)
        .ok_or("no unit_exposure budget")?;
    let mut over = Vec::new();
    for (unit, limit) in limits {
        let limit = limit
            .as_f64()
            .ok_or_else(|| format!("bad budget for {unit}"))?;
        let shown = vm.run(&format!(
            "systemd-analyze security --no-pager {unit} | sed -n 's/.*exposure level for .*: \\([0-9.]*\\).*/\\1/p'"
        ))?;
        let score: f64 = shown
            .trim()
            .parse()
            .map_err(|_| format!("{unit}: {shown}"))?;
        drop(std::io::stderr().write_all(format!("      {unit}: {score} of {limit}\n").as_bytes()));
        if score > limit {
            over.push(format!("{unit} {score} > {limit}"));
        }
    }
    ensure(over.is_empty(), over.join(", "))
}

/// No program on this machine offers a login: no SSH server, no getty, root locked.
pub(crate) fn no_login_anywhere(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let sshd =
        vm.run("ls /usr/sbin/sshd /usr/sbin/dropbear /usr/sbin/telnetd 2>/dev/null; true")?;
    ensure(sshd.is_empty(), format!("a remote login server: {sshd}"))?;
    for unit in LOGIN_UNITS {
        let state = vm.run(&format!("systemctl is-enabled {unit} 2>/dev/null; true"))?;
        // A debug image's command line masks the serial ones again at run time: still masked.
        ensure(
            state.trim().starts_with("masked"),
            format!("{unit} is {state}"),
        )?;
    }
    let gettys = vm.run("pgrep -c '^(agetty|getty|login|sshd)$'; true")?;
    ensure(
        gettys.trim() == "0",
        format!("{gettys} login programs running"),
    )?;
    let root = vm.run("passwd -S root | cut -d' ' -f2")?;
    ensure(
        root.trim() == "L",
        format!("root's password is {root}, not locked"),
    )
}

/// Ctrl+Alt+Del does nothing: its target is masked and seven presses in two seconds are not a forced reboot,
/// so a kiosk keyboard cannot restart a ward machine from any console.
pub(crate) fn ctrl_alt_del_does_nothing(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let state = vm.run(
        "systemctl is-enabled ctrl-alt-del.target 2>/dev/null; systemctl show -p CtrlAltDelBurstAction --value; true",
    )?;
    ensure(
        state.split_whitespace().eq(["masked", "none"]),
        format!("Ctrl+Alt+Del: {state}"),
    )
}

/// A release image, from outside: nothing on SSH, and its serial port shows no login and runs no
/// command, however long after boot a cable is plugged in.
pub(crate) fn run_release(image: &Path) -> Result<usize, String> {
    let mut vm = Vm::spawn(image, None)?;
    std::thread::sleep(vm::scaled(RELEASE_BOOT));
    let mut failed = 0;
    let ssh = vm.reachable("ssh").map(|open| !open);
    failed += report(
        "SSH does not answer",
        &ssh.and_then(|ok| ensure(ok, "answered")),
    );
    let serial = serial_offers_nothing(&mut vm);
    failed += report("the serial port offers no login and runs nothing", &serial);
    Ok(failed)
}

/// Presses Enter on the serial port, then types a command, and listens for any sign of a shell.
fn serial_offers_nothing(vm: &mut Vm) -> Result<(), String> {
    let port = vm.serial_port();
    port.set_read_timeout(Some(Duration::from_millis(200)))
        .map_err(|e| e.to_string())?;
    // What the boot printed so far is not an answer to us.
    listen(port, SERIAL_LISTEN);
    port.write_all(b"\r\n\r\nroot\r\necho SERIAL$((6*7))SHELL\r\n")
        .map_err(|e| e.to_string())?;
    let text = listen(port, SERIAL_LISTEN);
    ensure(
        !text.contains("SERIAL42SHELL"),
        "a command ran on the serial port",
    )?;
    let sign = SHELL_SIGNS.iter().find(|sign| text.contains(*sign));
    ensure(sign.is_none(), format!("the serial port showed {sign:?}"))
}

/// Everything the port prints for `limit`, terminal codes removed.
fn listen(port: &mut std::os::unix::net::UnixStream, limit: Duration) -> String {
    let (mut seen, mut buffer, end) = (Vec::new(), [0_u8; 4096], Instant::now() + limit);
    while Instant::now() < end {
        if let Ok(count) = port.read(&mut buffer) {
            seen.extend_from_slice(buffer.get(..count).unwrap_or_default());
        }
    }
    vm::strip_terminal_codes(&String::from_utf8_lossy(&seen))
}

/// Prints one result line and returns 1 if it failed.
fn report(name: &str, result: &Result<(), String>) -> usize {
    let line = match result {
        Ok(()) => format!("pass  {name}\n"),
        Err(why) => format!("FAIL  {name}: {why}\n"),
    };
    drop(std::io::stderr().write_all(line.as_bytes()));
    usize::from(result.is_err())
}

/// Records how long this boot took, kernel and user space, so hardening's cost on start-up is measured.
pub(crate) fn boot_time_recorded(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let time = vm.run("systemd-analyze time --no-pager | head -1")?;
    drop(std::io::stderr().write_all(format!("      {time}\n").as_bytes()));
    ensure(time.contains("Startup finished"), time)
}

/// Sandboxed root helpers still see what they read: `time-role` must find a node's marker behind
/// `/var/lib/medbrains` (0750) and choose the main machine's clock. An empty capability set once hid it.
pub(crate) fn sandboxed_helpers_still_read(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let node = vm.run("touch /var/lib/medbrains/config/role-node; systemctl restart medbrains-time-role; cat /run/medbrains-role/time.conf; rm -f /var/lib/medbrains/config/role-node; systemctl restart medbrains-time-role")?;
    ensure(
        node.contains("server 127.0.0.1"),
        format!("a node's time sources: {node}"),
    )
}
