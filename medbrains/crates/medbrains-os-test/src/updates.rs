//! Proves A/B updates (`docs/architecture/OS-UPDATES.md`) on real QEMU machines: each scenario boots a copy
//! of one set-up machine, and a power cut is QEMU killed. Bundles are made by
//! `os/tests/make-update-bundles.py`. Steps in `update_steps.rs` name the requirement they prove.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use serde_json::Value;

use crate::vm::{self, Vm, make_overlay};
use crate::{setup, update_steps};

const SETUP_LIMIT: Duration = Duration::from_secs(180);
const POLL: Duration = Duration::from_secs(3);
/// How long a new version gets here: long enough for the server, short enough to test a failure.
const HEALTH_SECONDS: u64 = 120;
/// Files a person's settings and the machine's identity live in. The screen's shader cache is left out, as
/// a cache. The database is compared separately, because its files change whenever it runs: what must not
/// change is what it holds.
const KEPT: &str = "/var/lib/medbrains/config /var/lib/medbrains-settings /var/lib/medbrains/network /var/lib/medbrains/os-test-canary /var/lib/iwd /var/lib/kiosk";
const CANARY_ROWS: u32 = 100_000;
/// The set-up machine's firmware variables, which every scenario starts from, as it starts from its disk.
const BASE_VARS: &str = "vars-base.fd";
const READ_VERSION: &str = "sed -n 's/^IMAGE_VERSION=//p' /usr/lib/os-release | tr -d '\"'";
/// Where the guest finds the host running this test.
const HOST: &str = "10.0.2.2";

/// A scenario: everything it needs is in the bench and the machine.
pub(crate) type Scenario = (&'static str, fn(&mut Vm, &Bench) -> Result<(), String>);

/// What every scenario shares.
pub(crate) struct Bench {
    /// Host port of the HTTPS server holding the bundles.
    pub(crate) port: u16,
    /// Where the bundles are on the host.
    pub(crate) bundles: PathBuf,
    /// The version the image was built as.
    pub(crate) first: String,
    /// The first administrator's password, for signing in as a person.
    pub(crate) password: String,
    server: Child,
}

impl Drop for Bench {
    /// Stops the bundle server.
    fn drop(&mut self) {
        // Best effort: the test is ending.
        drop(self.server.kill());
        drop(self.server.wait());
    }
}

/// Prints one line of the report.
pub(crate) fn say(line: &str) {
    drop(writeln!(std::io::stderr(), "{line}"));
}

/// Fails with `message` unless `ok`.
pub(crate) fn ensure(ok: bool, message: impl Into<String>) -> Result<(), String> {
    if ok { Ok(()) } else { Err(message.into()) }
}

/// The TPM this machine boots with, if the platform has one.
pub(crate) fn own_tpm() -> Option<&'static str> {
    vm::tpm_usable().then_some(vm::OWN_TPM)
}

/// Makes a certificate for the host as the guest sees it, and starts the bundle server.
fn start_server(bundles: &Path, work: &Path) -> Result<(u16, Child, String), String> {
    let (key, cert) = (work.join("mirror.key"), work.join("mirror.pem"));
    let made = Command::new("openssl")
        .args([
            "req",
            "-x509",
            "-newkey",
            "ec",
            "-pkeyopt",
            "ec_paramgen_curve:P-256",
        ])
        .args(["-nodes", "-days", "2", "-subj", "/CN=medbrains-test-mirror"])
        .args(["-addext", &format!("subjectAltName=IP:{HOST}")])
        .arg("-keyout")
        .arg(&key)
        .arg("-out")
        .arg(&cert)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| e.to_string())?;
    ensure(made.success(), "could not make the test certificate")?;
    let port = std::net::TcpListener::bind("0.0.0.0:0")
        .and_then(|listener| listener.local_addr())
        .map_err(|e| e.to_string())?
        .port();
    let script = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../os/tests/serve-bundles.py");
    let server = Command::new("python3")
        .arg(script)
        .arg(bundles)
        .arg(port.to_string())
        .arg(&cert)
        .arg(&key)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| e.to_string())?;
    sleep(Duration::from_secs(1));
    let pem = std::fs::read_to_string(&cert).map_err(|e| e.to_string())?;
    Ok((port, server, pem))
}

/// Writes what the scenarios later prove survived: a settings tree, a file of random bytes and a table.
fn write_canaries(vm: &mut Vm, pem: &str) -> Result<(), String> {
    // First boot removes the setup lines from the env once the server answers. Waiting keeps that ordinary
    // first-run change out of every comparison.
    let deadline = Instant::now() + vm::scaled(SETUP_LIMIT);
    while vm.run("grep -c MEDBRAINS_SEED /var/lib/medbrains/config/env; true")? != "0" {
        ensure(
            Instant::now() < deadline,
            "the setup lines never left the env",
        )?;
        sleep(POLL);
    }
    vm.run(&format!(
        "printf '%s' '{pem}' > /var/lib/medbrains-settings/update-ca.pem"
    ))?;
    let health = vm::scaled(Duration::from_secs(HEALTH_SECONDS)).as_secs();
    vm.run(&format!(
        "echo {health} > /var/lib/medbrains-settings/update-health-seconds"
    ))?;
    vm.run("head -c 16M /dev/urandom > /var/lib/medbrains/os-test-canary; echo hello > /var/lib/medbrains-settings/os-test-setting")?;
    let sql = format!(
        "CREATE TABLE os_test_canary AS SELECT n, md5(n::text) AS body FROM generate_series(1,{CANARY_ROWS}) n"
    );
    let done = vm.run(&format!(
        "runuser -u postgres -- psql -d medbrains -Atc \"{sql}\"; sync"
    ))?;
    ensure(done.contains("SELECT"), format!("the canary table: {done}"))
}

/// Everything that must stay byte-identical, one line per item. Machine-readable so a difference names
/// itself. Owner and mode count too: a shifted user id would break a service without changing a byte.
pub(crate) fn var_snapshot(vm: &mut Vm) -> Result<String, String> {
    let files = format!(
        "find {KEPT} -type f ! -path '*/.cache/*' 2>/dev/null | sort | while read -r f; do printf '%s %s ' \"$f\" \"$(stat -c '%U:%G:%a:%s' \"$f\")\"; sha256sum < \"$f\"; done"
    );
    let tables = "runuser -u postgres -- psql -d medbrains -Atc \"SELECT 'canary', count(*), md5(string_agg(body, '' ORDER BY n)) FROM os_test_canary\"";
    let schema = "echo schema $(runuser -u postgres -- pg_dump -d medbrains --schema-only --restrict-key=mbtest | sha256sum)";
    let users = "runuser -u postgres -- psql -d medbrains -Atc \"SELECT 'people', (SELECT count(*) FROM users), (SELECT md5(string_agg(id::text || password_hash, ',' ORDER BY id)) FROM users), (SELECT md5(string_agg(id::text || name, ',' ORDER BY id)) FROM tenants)\"";
    let identity = "echo machine-id $(cat /etc/machine-id) $(stat -c %a /etc/machine-id)";
    let snapshot = vm.run_for(
        &format!("{files}; {tables}; {schema}; {users}; {identity}"),
        Duration::from_secs(120),
    )?;
    // A query that failed would leave these out of both sides of a comparison, and prove nothing.
    ensure(
        snapshot.contains(&format!("canary|{CANARY_ROWS}|")) && snapshot.contains("people|"),
        format!("the snapshot is missing its database rows: {snapshot}"),
    )?;
    Ok(snapshot)
}

/// Fails, naming each line that changed, unless `after` equals `before`.
pub(crate) fn same_var(before: &str, after: &str) -> Result<(), String> {
    let changed: Vec<&str> = after
        .lines()
        .filter(|line| !before.contains(*line))
        .collect();
    let gone: Vec<&str> = before
        .lines()
        .filter(|line| !after.contains(*line))
        .collect();
    ensure(
        changed.is_empty() && gone.is_empty(),
        format!("/var changed. New: {changed:?} Gone: {gone:?}"),
    )
}

/// Lets the guest reach the bundle server, which the firewall blocks after each boot: a test's port is
/// not the 443 the machine really uses.
pub(crate) fn open_mirror(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    vm.run(&format!(
        "nft insert rule inet medbrains output ip daddr {HOST} tcp dport {} accept",
        bench.port
    ))
    .map(|_| ())
}

/// The address of a bundle.
pub(crate) fn url(bench: &Bench, name: &str) -> String {
    format!("https://{HOST}:{}/{name}", bench.port)
}

/// The version the machine is running.
pub(crate) fn running_version(vm: &mut Vm) -> Result<String, String> {
    vm.run(READ_VERSION)
}

/// What the screen is told.
pub(crate) fn status(vm: &mut Vm) -> Result<Value, String> {
    let text = vm.run("medbrains-os-update status")?;
    serde_json::from_str(&text).map_err(|e| format!("status {text}: {e}"))
}

/// Waits for the machine to be running `version`, however many restarts that takes. Nothing is sent
/// while it restarts: see `Vm::wait_for_restart`.
pub(crate) fn wait_version(
    vm: &mut Vm,
    version: &str,
    limit: Duration,
) -> Result<Duration, String> {
    let started = Instant::now();
    let limit = vm::scaled(limit);
    loop {
        let asked = vm.run_for(READ_VERSION, vm::scaled(Duration::from_secs(4)));
        if asked.as_ref().is_ok_and(|text| text == version) {
            return Ok(started.elapsed());
        }
        let left = limit.saturating_sub(started.elapsed());
        ensure(!left.is_zero(), format!("never running {version}"))?;
        // No answer: the machine is restarting, and a fast restart (a failed seal check takes under four
        // seconds) can put its firmware line inside the read above, where a wait for the next one would
        // never end. Ask again instead. A shell that answers another version waits for the next restart.
        if asked.is_err() {
            sleep(POLL);
            continue;
        }
        vm.wait_for_restart(left)
            .map_err(|e| format!("never running {version}: {e}"))?;
    }
}

/// Waits for the record to say `field` is `want`.
pub(crate) fn wait_status(
    vm: &mut Vm,
    path: &[&str],
    want: &str,
    limit: Duration,
) -> Result<Value, String> {
    let deadline = Instant::now() + vm::scaled(limit);
    let mut last = Value::Null;
    while Instant::now() < deadline {
        if let Ok(now) = vm.run_for("medbrains-os-update status", Duration::from_secs(10))
            && let Ok(value) = serde_json::from_str::<Value>(&now)
        {
            let got = path.iter().fold(&value, |v, key| &v[*key]);
            if got == want {
                return Ok(value);
            }
            last = value;
        }
        sleep(POLL);
    }
    let earlier = vm.run("journalctl -b -1 --no-pager -p warning -n 30 -o short-monotonic | cut -c1-160; echo NOW; journalctl -b --no-pager -u 'medbrains-os-update@*' -n 15 -o short-monotonic | cut -c1-200; ps -eo pid,stat,wchan:20,args | grep -E 'sfdisk|udevadm|mount|zstd|dd |medbrains-os-update' | grep -v grep");
    Err(format!(
        "{path:?} never became {want}. Last: {last}. The boot before said: {earlier:?}"
    ))
}

/// Powers on a set-up machine from `disk` and waits for its shell and its server, printing how long each
/// took and systemd's own count. Every scenario starts this way, so each run also measures a cold start
/// with the seal on. On x86-64 the shell time includes the fixed wait that keeps keys out of the firmware.
fn cold_start(vm: &mut Vm, disk: &Path) -> Result<(), String> {
    let started = Instant::now();
    vm.boot(disk, own_tpm())?;
    let shell = started.elapsed();
    vm.wait_for_server()?;
    let server = started.elapsed();
    let systemd = vm.run("systemd-analyze 2>&1 | head -1").unwrap_or_default();
    say(&format!(
        "      cold start: shell {:.1}s, server {:.1}s; {systemd}",
        shell.as_secs_f32(),
        server.as_secs_f32()
    ));
    Ok(())
}

/// What a failed scenario's machine says about itself, if its shell still answers: failed units, waiting
/// jobs and this start's warnings, so a failure can be explained without running it again.
fn failure_notes(vm: &mut Vm) -> String {
    vm.run_for(
        "systemctl --failed --no-legend --plain; echo RUNNING; systemctl list-jobs --no-legend | grep -v waiting | head -10; \
         systemctl status --no-pager -n 5 medbrains-seal medbrains-disk-setup 2>&1 | cut -c1-200 | head -40; \
         echo ENTRIES; bootctl list --no-pager 2>&1 | grep -E 'title|source|tries' | head -12; \
         echo BEFORE; journalctl -b -1 --no-pager -p warning -n 20 -o short-monotonic 2>&1 | cut -c1-220; \
         echo LOG; journalctl -b --no-pager -p warning -n 40 -o short-monotonic | cut -c1-220",
        Duration::from_secs(60),
    )
    .unwrap_or_else(|why| format!("no shell: {why}"))
}

/// Plays one scenario on a copy of the set-up machine, and removes the copy.
fn play(vm: &mut Vm, bench: &Bench, base: &Path, scenario: &Scenario) -> bool {
    let started = Instant::now();
    let overlay = vm.scratch_path("scenario.qcow2");
    // The firmware's variables are part of the machine: a scenario that hung one must not choose what
    // the next one boots.
    let firmware = std::fs::copy(vm.scratch_path(BASE_VARS), vm.scratch_path("vars.fd"))
        .map(|_| ())
        .map_err(|e| format!("firmware variables: {e}"));
    let result = firmware
        .and_then(|()| make_overlay(base, &overlay))
        .and_then(|()| cold_start(vm, &overlay))
        .and_then(|()| open_mirror(vm, bench))
        .and_then(|()| (scenario.1)(vm, bench));
    let notes = result.as_ref().err().map(|_| failure_notes(vm));
    // Already off is the only way this fails.
    drop(vm.cut_power());
    drop(std::fs::remove_file(&overlay));
    match &result {
        Ok(()) => say(&format!(
            "pass  {} ({:.0}s)",
            scenario.0,
            started.elapsed().as_secs_f32()
        )),
        Err(why) => say(&format!(
            "FAIL  {}: {why}\n      the machine said: {}",
            scenario.0,
            notes.unwrap_or_default()
        )),
    }
    result.is_ok()
}

/// Sets up one machine, then plays every scenario on a copy of it; returns how many failed.
pub(crate) fn run(image: &Path, bundles: &Path) -> Result<usize, String> {
    let first = std::fs::read_to_string(bundles.join("first-version"))
        .map_err(|e| format!("{}: {e}", bundles.display()))?
        .trim()
        .to_owned();
    let only = std::env::var("MB_OS_TEST_ONLY").unwrap_or_default();
    let mut vm = Vm::start(image)?;
    let (port, server, pem) = start_server(bundles, &vm.scratch_path(""))?;
    let mut bench = Bench {
        port,
        bundles: bundles.to_owned(),
        first,
        password: String::new(),
        server,
    };
    bench.password = setup::set_up_main(&mut vm)?;
    vm.wait_for_server()?;
    write_canaries(&mut vm, &pem)?;
    vm.shut_down()?;
    std::fs::copy(vm.scratch_path("vars.fd"), vm.scratch_path(BASE_VARS))
        .map_err(|e| format!("firmware variables: {e}"))?;
    let base = vm.disk();
    let mut failed = 0;
    for scenario in update_steps::scenarios() {
        if only.is_empty() || only.split(',').any(|name| scenario.0.contains(name)) {
            failed += usize::from(!play(&mut vm, &bench, &base, &scenario));
        }
    }
    Ok(failed)
}
