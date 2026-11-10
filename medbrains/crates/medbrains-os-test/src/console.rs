//! The support console's boot-health view (#5383): a service made to fail shows on tty2 with a reason
//! in hospital words, its unit name and its last log lines.

use std::time::Duration;

use serde_json::Value;

use crate::ensure;
use crate::vm::Vm;

/// A real unit, made to fail by a drop-in in /run: its mapping is tested, not only the list. Safe to
/// break for a moment, and put back by removing the drop-in.
const FAILING: &str = "medbrains-time-role.service";
const REASON: &str = "The clock could not be checked";
const DROP_IN: &str = "/run/systemd/system/medbrains-time-role.service.d";
const LAST_WORDS: &str = "os-test: the time sources could not be written";
/// Longer than the view's redraw interval.
const REDRAW: Duration = Duration::from_secs(8);

/// A failed service appears on the console with its reason, its name and its last log line.
pub(crate) fn failure_shows_on_the_console(vm: &mut Vm, _: &Value) -> Result<(), String> {
    vm.run(&format!(
        "mkdir -p {DROP_IN}; printf '[Service]\\nExecStart=\\nExecStart=/bin/sh -c \"echo {LAST_WORDS}; exit 3\"\\n' > {DROP_IN}/fail.conf; systemctl daemon-reload; systemctl restart {FAILING}; sleep 2"
    ))?;
    std::thread::sleep(REDRAW);
    let once = vm.run("/usr/lib/medbrains/boot-health --once")?;
    let screen = vm.run("cat /dev/vcs2 | tr -s ' '")?;
    vm.run(&format!(
        "rm -r {DROP_IN}; systemctl daemon-reload; systemctl reset-failed {FAILING}; systemctl restart {FAILING}"
    ))?;
    for (where_, text) in [("--once", &once), ("tty2", &screen)] {
        for want in [REASON, FAILING, LAST_WORDS] {
            ensure(
                text.contains(want),
                format!("{where_} lacks {want:?}: {text}"),
            )?;
        }
    }
    Ok(())
}

/// Prints the milliseconds until the shell runs again after its current one is killed, or 99999.
const KILL_SHELL: &str = "old=$(pidof -s medbrains-shell); kill -9 $old; t=$(date +%s%N); while :; do new=$(pidof -s medbrains-shell); [ -n \"$new\" ] && [ \"$new\" != \"$old\" ] && break; [ $(( ($(date +%s%N) - t) / 1000000 )) -gt 20000 ] && { echo 99999; exit 0; }; sleep 0.05; done; echo $(( ($(date +%s%N) - t) / 1000000 ))";
/// Longest the screen may be gone after the shell crashes: was 3 s of black before RestartSec=200ms.
const COMEBACK_MS: u64 = 1500;
/// Kills the shell each time it is up, until cage-console fails, at most 60 tries (StartLimitBurst is 10).
const CRASH_LOOP: &str = "for i in $(seq 60); do systemctl -q is-failed cage-console && break; p=$(pidof -s medbrains-shell) && kill -9 $p; sleep 0.3; done";

/// A crashed shell is back within the limit, and a crash loop leaves boot-health on the screen, not
/// black; starting the screen again takes tty1 back.
pub(crate) fn screen_is_never_left_black(vm: &mut Vm, _: &Value) -> Result<(), String> {
    vm.run("systemctl reset-failed cage-console")?;
    let took = crate::number(vm, KILL_SHELL)?;
    drop(std::io::Write::write_all(
        &mut std::io::stderr(),
        format!("      shell back after a crash in {took} ms\n").as_bytes(),
    ));
    ensure(
        took <= COMEBACK_MS,
        format!("the screen was gone {took} ms"),
    )?;
    // Crash whenever a shell is up, until systemd gives up: a kill that lands between restarts counts nothing.
    vm.run_for(CRASH_LOOP, crate::vm::scaled(Duration::from_secs(40)))?;
    std::thread::sleep(REDRAW);
    let state =
        vm.run("systemctl is-failed cage-console; systemctl is-active medbrains-boot-health@tty1")?;
    let status =
        vm.run("systemctl status --no-pager -n 4 medbrains-boot-health@tty1 | tail -6; true")?;
    let screen = vm.run("cat /dev/vcs1 | tr -s ' '")?;
    vm.run("systemctl reset-failed cage-console; systemctl start cage-console; sleep 3")?;
    let back = vm.run(
        "systemctl is-active cage-console; systemctl is-active medbrains-boot-health@tty1; true",
    )?;
    ensure(
        state.split_whitespace().eq(["failed", "active"]),
        format!("after a crash loop: {state}\n{status}"),
    )?;
    for want in [
        "how this machine started",
        "The screen did not start",
        "cage-console.service",
    ] {
        ensure(
            screen.contains(want),
            format!("tty1 lacks {want:?}: {screen}"),
        )?;
    }
    ensure(
        back.split_whitespace().eq(["active", "inactive"]),
        format!("restarting the screen: {back}"),
    )
}
