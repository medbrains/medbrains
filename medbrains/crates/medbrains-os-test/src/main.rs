//! Boots a fresh debug OS image and checks what every image must do, from inside and outside.
//!
//!     cargo run -p medbrains-os-test -- <image.raw> [disk]
//!
//! `disk` runs only the data disk scenarios. Needs `make os-image DEBUG=1`, QEMU and swtpm. Exits non-zero if any check fails. Budgets are in
//! `budgets.json`: ratchets to lower as the numbers improve (targets: RFC-HOSPITAL-OS §3a).

mod disk;
mod vm;

use std::path::Path;
use std::process::ExitCode;
use std::time::{Duration, Instant};

use serde_json::Value;
use vm::Vm;

const BUDGETS: &str = include_str!("../budgets.json");
const BLOCKED_MODULES: [&str; 3] = ["dccp", "sctp", "udf"];
const SYSCTLS: [(&str, &str); 4] = [
    ("kernel.kptr_restrict", "2"),
    ("kernel.kexec_load_disabled", "1"),
    ("kernel.yama.ptrace_scope", "2"),
    ("net.ipv4.conf.all.accept_redirects", "0"),
];
const CLOSED_FROM_OUTSIDE: [&str; 4] = ["ssh", "server", "database", "edge"];
const TIME_SYNC_LIMIT: Duration = Duration::from_secs(120);
const SETUP_LIMIT: Duration = Duration::from_secs(90);
const SETUP_SOCKET: &str = "/run/medbrains-console/setup.sock";

type Check = (&'static str, fn(&mut Vm, &Value) -> Result<(), String>);

/// Fails with `message` unless `ok`.
fn ensure(ok: bool, message: impl Into<String>) -> Result<(), String> {
    if ok { Ok(()) } else { Err(message.into()) }
}

/// A budget from `budgets.json`, in megabytes.
fn budget(budgets: &Value, key: &str) -> Result<u64, String> {
    budgets
        .get(key)
        .and_then(Value::as_u64)
        .ok_or_else(|| format!("no budget {key}"))
}

/// A number printed by a command inside the machine.
fn number(vm: &mut Vm, command: &str) -> Result<u64, String> {
    let text = vm.run(command)?;
    text.trim()
        .parse()
        .map_err(|_| format!("not a number: {text}"))
}

/// Shows a measured number beside its limit, so a pass still says how close it was.
fn within(what: &str, used: u64, limit: u64) -> Result<(), String> {
    let line = format!("      {what}: {used} MB of {limit} MB\n");
    drop(std::io::Write::write_all(
        &mut std::io::stderr(),
        line.as_bytes(),
    ));
    ensure(used <= limit, format!("{used} MB over {limit} MB"))
}

/// No service has failed.
fn no_failed_services(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let failed = vm.run("systemctl --failed --no-legend --plain")?;
    ensure(failed.is_empty(), failed)
}

/// The app answers through the front proxy.
fn app_answers(vm: &mut Vm, _: &Value) -> Result<(), String> {
    ensure(
        vm.status("web", "https", "/api/health")? == 200,
        "health did not answer",
    )?;
    ensure(
        vm.status("web", "https", "/login")? == 200,
        "sign-in page did not answer",
    )
}

/// Plain HTTP does nothing but redirect.
fn http_only_redirects(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let status = vm.status("http", "http", "/api/health")?;
    ensure(status == 301, format!("answered {status}"))
}

/// Only the listed services answer from outside.
fn nothing_else_reachable(vm: &mut Vm, _: &Value) -> Result<(), String> {
    for name in CLOSED_FROM_OUTSIDE {
        ensure(
            !vm.reachable(name)?,
            format!("{name} answered from outside"),
        )?;
    }
    Ok(())
}

/// All three firewall chains drop by default.
fn firewall_denies_by_default(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let count = vm.run("nft list ruleset | grep -c 'policy drop'")?;
    ensure(count == "3", format!("{count} chains drop by default"))
}

/// Server and database bind to this machine only.
fn server_and_database_stay_local(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let listening = vm.run("ss -tlnH | awk '{print $4}'")?;
    let exposed: Vec<&str> = listening
        .split_whitespace()
        .filter(|a| {
            (a.ends_with(":3000") || a.ends_with(":5432"))
                && !a.starts_with("127.")
                && !a.starts_with("[::1]")
        })
        .collect();
    ensure(exposed.is_empty(), format!("exposed: {exposed:?}"))
}

/// The database's own service refuses other addresses, whatever the firewall does.
fn database_limited_by_systemd(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let shown = vm.run("systemctl show postgresql@17-main -p IPAddressDeny -p IPAddressAllow")?;
    ensure(
        shown.contains("0.0.0.0/0") && shown.contains("127.0.0.0/8"),
        shown,
    )
}

/// Plain outbound HTTP is dropped, and the drop is logged.
fn outbound_http_blocked(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let code =
        vm.run("curl -s -m 5 -o /dev/null -w '%{http_code}' http://deb.debian.org/; true")?;
    ensure(code == "000", format!("answered {code}"))?;
    let log = vm.run("journalctl -k --no-pager -g medbrains-drop-out -n 1 -o cat")?;
    ensure(
        log.contains("medbrains-drop-out"),
        "the drop was not logged",
    )
}

/// Unused kernel modules cannot load.
fn blocked_modules_refuse(vm: &mut Vm, _: &Value) -> Result<(), String> {
    for module in BLOCKED_MODULES {
        let code = vm.run(&format!("modprobe {module} >/dev/null 2>&1; echo $?"))?;
        ensure(code == "1", format!("{module} returned {code}"))?;
    }
    Ok(())
}

/// Kernel hardening settings are applied.
fn kernel_hardening_applied(vm: &mut Vm, _: &Value) -> Result<(), String> {
    for (name, want) in SYSCTLS {
        let got = vm.run(&format!("sysctl -n {name}"))?;
        ensure(got == want, format!("{name} is {got}"))?;
    }
    Ok(())
}

/// Kernel lockdown is on.
fn lockdown_on(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let mode = vm.run("cat /sys/kernel/security/lockdown")?;
    ensure(mode.contains("[integrity]"), mode)
}

/// Time is synced from an authenticated source.
fn time_authenticated(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let deadline = Instant::now() + TIME_SYNC_LIMIT;
    while vm.run("chronyc -n tracking | awk '/Leap status/{print $4}'")? != "Normal" {
        ensure(Instant::now() < deadline, "time did not sync")?;
        std::thread::sleep(Duration::from_secs(5));
    }
    let auth = vm.run("chronyc -N authdata")?;
    ensure(auth.contains("NTS"), "no authenticated time source")
}

/// Every key that protects something was made on this machine, none baked into the image.
fn no_shared_private_key(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let found = vm.run("ls /etc/ssl/private/; true")?;
    ensure(
        found.is_empty(),
        format!("private keys in the image: {found}"),
    )?;
    let env = vm.run("grep -cE '^MEDBRAINS_(EVENT_TOKEN|SIGNATURE_KEY_ENCRYPTION|OAUTH_TOKEN)_?KEY=.{32}' /etc/medbrains/env")?;
    ensure(
        env == "3",
        format!("{env} of 3 keys that would fall back to public development keys"),
    )
}

/// Memory at rest is within budget.
fn idle_memory(vm: &mut Vm, budgets: &Value) -> Result<(), String> {
    let used = number(
        vm,
        "awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{print int((t-a)/1024)}' /proc/meminfo",
    )?;
    within("machine", used, budget(budgets, "idle_machine_mb")?)
}

/// System disk use is within budget.
fn system_disk(vm: &mut Vm, budgets: &Value) -> Result<(), String> {
    let used = number(vm, "df -m --output=used / | tail -1 | tr -d ' '")?;
    within("system disk", used, budget(budgets, "system_disk_used_mb")?)
}

/// Opening a page must not balloon the server: reused connections once took it past 1 GB.
fn page_load_memory(vm: &mut Vm, budgets: &Value) -> Result<(), String> {
    vm.run_for("cd /usr/share/medbrains/web/assets; ls | grep -E '\\.(js|css)$' | sort | head -70 | xargs -P 30 -I@ curl -sk -m 40 -o /dev/null https://127.0.0.1:8443/assets/@; cd /", Duration::from_secs(120))?;
    let used = number(
        vm,
        "awk '/^Rss:/{print int($2/1024)}' /proc/$(pidof medbrains-server)/smaps_rollup",
    )?;
    within(
        "server",
        used,
        budget(budgets, "server_after_page_load_mb")?,
    )
}

/// Holding connections must not grow the server: each one once kept its own 28 MB route table.
fn held_connections_stay_cheap(vm: &mut Vm, budgets: &Value) -> Result<(), String> {
    let rss = "awk '/^Rss:/{print int($2/1024)}' /proc/$(pidof medbrains-server)/smaps_rollup";
    let before = number(vm, rss)?;
    let hold = format!(
        "(for fd in $(seq 10 59); do eval \"exec $fd<>/dev/tcp/127.0.0.1/3000\"; printf 'GET /api/health HTTP/1.1\\r\\nHost: x\\r\\n\\r\\n' >&$fd; done; sleep 3; {rss})"
    );
    let after: u64 = vm
        .run_for(&hold, Duration::from_secs(30))?
        .trim()
        .parse()
        .map_err(|_| "no reading while holding connections".to_owned())?;
    within(
        "growth from 50 held connections",
        after.saturating_sub(before),
        budget(budgets, "growth_50_connections_mb")?,
    )
}

/// Slow-query logging must not copy patient values, and its log must have a size limit.
fn database_log_is_safe(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let read = "runuser -u postgres -- psql -Atc \"select current_setting('log_parameter_max_length'), current_setting('log_parameter_max_length_on_error'), current_setting('log_destination')\"";
    let text = vm.run(read)?;
    ensure(
        text.trim() == "0|0|syslog",
        format!("found {}", text.trim()),
    )
}

/// Every check, in order.
fn checks() -> Vec<Check> {
    vec![
        ("no service has failed", no_failed_services),
        ("the app answers through the front proxy", app_answers),
        ("plain HTTP only redirects", http_only_redirects),
        (
            "nothing else is reachable from outside",
            nothing_else_reachable,
        ),
        (
            "the firewall denies by default both ways",
            firewall_denies_by_default,
        ),
        (
            "server and database listen only on this machine",
            server_and_database_stay_local,
        ),
        (
            "the database service refuses other addresses",
            database_limited_by_systemd,
        ),
        (
            "outbound plain HTTP is blocked and logged",
            outbound_http_blocked,
        ),
        ("unused kernel modules cannot load", blocked_modules_refuse),
        ("kernel hardening is applied", kernel_hardening_applied),
        ("kernel lockdown is on", lockdown_on),
        (
            "time is synced by an authenticated source",
            time_authenticated,
        ),
        (
            "no private key is shared between machines",
            no_shared_private_key,
        ),
        ("idle memory is within budget", idle_memory),
        ("system disk is within budget", system_disk),
        (
            "opening a page does not balloon the server",
            page_load_memory,
        ),
        ("held connections stay cheap", held_connections_stay_cheap),
        (
            "the database log holds no values and is bounded",
            database_log_is_safe,
        ),
    ]
}

/// Makes this machine a main machine, as the screen's Review does: nothing runs before that. The
/// password is made fresh, so none is written down, and the machine is thrown away.
fn set_up_main(vm: &mut Vm) -> Result<(), String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let body =
        format!(r#"{{"hospital":"Test Hospital","username":"admin","password":"Os-{stamp}-Aa!"}}"#);
    let answer = vm.run_for(
        &format!("curl -s -m 80 --unix-socket {SETUP_SOCKET} -d '{body}' http://machine/hospital"),
        SETUP_LIMIT,
    )?;
    ensure(
        answer.contains("\"ok\":true"),
        format!("setup answered {answer}"),
    )
}

/// Boots the image and runs every check, then the data disk scenarios; returns how many failed.
fn run_suite(image: &Path) -> Result<usize, String> {
    let budgets: Value = serde_json::from_str(BUDGETS).map_err(|e| e.to_string())?;
    let mut vm = Vm::start(image)?;
    set_up_main(&mut vm)?;
    vm.wait_for_server()?;
    let mut failed = 0;
    for (name, check) in checks() {
        let started = Instant::now();
        let result = check(&mut vm, &budgets);
        let line = match &result {
            Ok(()) => format!("pass  {name} ({:.1}s)\n", started.elapsed().as_secs_f32()),
            Err(why) => format!("FAIL  {name}: {why}\n"),
        };
        failed += usize::from(result.is_err());
        drop(std::io::Write::write_all(
            &mut std::io::stderr(),
            line.as_bytes(),
        ));
    }
    Ok(failed + disk::run_sealed_disk(&mut vm, image)? + disk::run_without_sealed_disk(image))
}

/// Only the data disk scenarios, on a new machine.
fn run_disk_only(image: &Path) -> Result<usize, String> {
    let mut vm = Vm::start(image)?;
    Ok(disk::run_sealed_disk(&mut vm, image)? + disk::run_without_sealed_disk(image))
}

fn main() -> ExitCode {
    let Some(image) = std::env::args().nth(1) else {
        drop(std::io::Write::write_all(
            &mut std::io::stderr(),
            b"usage: medbrains-os-test <image.raw>\n",
        ));
        return ExitCode::from(2);
    };
    let image = Path::new(&image);
    let result = if std::env::args().nth(2).as_deref() == Some("disk") {
        run_disk_only(image)
    } else {
        run_suite(image)
    };
    match result {
        Ok(0) => ExitCode::SUCCESS,
        Ok(_) => ExitCode::FAILURE,
        Err(why) => {
            drop(std::io::Write::write_all(
                &mut std::io::stderr(),
                format!("could not run: {why}\n").as_bytes(),
            ));
            ExitCode::from(2)
        }
    }
}
