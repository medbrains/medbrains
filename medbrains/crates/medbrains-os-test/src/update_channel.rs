//! The release channel against TUF's list of attacks (`OS-UPDATES.md`, "Against TUF's attacks") and the rules
//! around it: U1.5 mix-and-match, U1.6 a rolled-back version stays refused, U1.8 catching up in order.

use crate::update_steps::{
    AFTER, BAD_SERVER, FINGERPRINT, INSTALL_LIMIT, NEXT, RESTART_LIMIT, SLOT, apply_and_prove, ask,
    ask_restart, install_from,
};
use crate::updates::{Bench, ensure, open_mirror, status, url, wait_status, wait_version};
use crate::vm::Vm;

/// TUF's mix-and-match attack: a manifest from one release with a boot file from another. One signed
/// manifest holds every file's hash, so the mixture fails before anything is written.
pub(crate) fn mixed_refused(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let fingerprint = FINGERPRINT.replace("SLOT", SLOT);
    let before = vm.run(&fingerprint)?;
    let (text, code) = install_from(vm, bench, "mixed", false)?;
    ensure(code == 2 && text.contains("changed after it was signed"), format!("{code} {text}"))?;
    ensure(vm.run(&fingerprint)? == before, "a refused mixture wrote to the disk")
}

/// U1.6, the trap Red Hat's image mode documents: the daily timer must not install again a version that
/// rolled back here. The channel still offers it, and the machine must stay where it is.
pub(crate) fn not_retried(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let (text, code) = install_from(vm, bench, BAD_SERVER.0, false)?;
    ensure(code == 0, format!("install: {text}"))?;
    ask_restart(vm, "apply")?;
    wait_version(vm, BAD_SERVER.1, RESTART_LIMIT)?;
    wait_version(vm, &bench.first, RESTART_LIMIT + RESTART_LIMIT)?;
    wait_status(vm, &["last", "result"], "rolled_back", RESTART_LIMIT)?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    vm.run(&format!("echo {} > /var/lib/medbrains-settings/update-url", url(bench, "channel-bad")))?;
    vm.run("systemctl start --wait medbrains-update-look.service; true")?;
    let value = status(vm)?;
    ensure(value["stage"] == "idle", format!("the timer installed it again: {value}"))?;
    let words = value["last"]["words"].as_str().unwrap_or("");
    ensure(words.contains("failed on this machine"), format!("not refused for that reason: {value}"))?;
    ensure(value["current"] == bench.first.as_str(), format!("{value}"))
}

/// U1.8: a machine two releases behind, offered only the newest, installs the release in between first,
/// and only then the newest. Kanidm upgrades one minor at a time, so no release may be skipped.
pub(crate) fn catches_up_in_order(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    vm.run(&format!("echo {} > /var/lib/medbrains-settings/update-url", url(bench, "channel-steps")))?;
    ask(vm, "install")?;
    let value = wait_status(vm, &["stage"], "waiting", INSTALL_LIMIT)?;
    ensure(value["target"] == NEXT.1, format!("skipped a step: {value}"))?;
    apply_and_prove(vm, bench, NEXT.1)?;
    ask(vm, "install")?;
    let value = wait_status(vm, &["stage"], "waiting", INSTALL_LIMIT)?;
    ensure(value["target"] == AFTER.1, format!("did not continue: {value}"))?;
    apply_and_prove(vm, bench, AFTER.1).map(|_| ())
}
