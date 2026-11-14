//! Updates on a sealed data disk (`OS-UPDATES.md`, "The sealed data disk"), which needs a TPM the guest can
//! use, so these run on x86-64 with swtpm and Secure Boot enforced. Requirement 6: no recovery key by
//! surprise; and the seal's two limits (`OS-KEYS.md`): an older system and an added loader entry.

use std::time::Instant;

use crate::update_steps::{
    FINGERPRINT, NEXT, RESTART_LIMIT, ROLLBACK_LIMIT, SLOT, apply_and_prove, ask_restart,
    install_from, install_ok,
};
use crate::updates::{Bench, ensure, same_var, say, url, var_snapshot, wait_version};
use crate::vm::Vm;

/// A bundle whose system carries a rollback number below the first image's, as `make-update-bundles.py`
/// names it. Its version is newer, so the updater installs it; only the floor can refuse it.
const LOW_ROLLBACK: (&str, &str) = ("low-rollback", "1.0.2");
/// A root hash no slot has: an attacker's system, as far as this machine knows.
const FOREIGN_ROOTHASH: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/// True if the data disk opened through its encrypted mapping.
fn disk_opened(vm: &mut Vm) -> Result<bool, String> {
    Ok(vm
        .run("findmnt -no SOURCE /var")?
        .contains("/dev/mapper/medbrains-data"))
}

/// The root hash this boot started with.
fn booted_roothash(vm: &mut Vm) -> Result<String, String> {
    vm.run("tr ' ' '\\n' < /proc/cmdline | sed -n 's/^roothash=//p'")
}

/// Requirement 6: the boot chain changes twice, and every start opens the disk by itself: the new
/// version's, then the old one's after going back. Secure Boot must be enforced, or the seal includes
/// PCR 4 and this proves nothing.
pub(crate) fn sealed_update(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let secure =
        vm.run("bootctl status 2>/dev/null | grep -c 'Secure Boot: enabled (user)'; true")?;
    ensure(secure == "1", "Secure Boot is not enforced on this machine")?;
    ensure(disk_opened(vm)?, "the disk is not sealed")?;
    let before = var_snapshot(vm)?;
    install_ok(vm, bench, NEXT.0, false)?;
    apply_and_prove(vm, bench, NEXT.1)?;
    ensure(disk_opened(vm)?, "the new version did not open the disk")?;
    same_var(&before, &var_snapshot(vm)?)?;
    ask_restart(vm, "go-back")?;
    wait_version(vm, &bench.first, RESTART_LIMIT)?;
    vm.wait_for_server()?;
    ensure(disk_opened(vm)?, "the old version did not open the disk")?;
    same_var(&before, &var_snapshot(vm)?)
}

/// Requirement 6: a boot file whose expected PCR 11 is signed by another key would ask for the recovery
/// key at its first start, so it is never installed. (It does not cover every cause: a system below the
/// rollback floor is installed and rolls back, `floor_refuses_older_system`.)
pub(crate) fn sealed_refusal(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let fingerprint = FINGERPRINT.replace("SLOT", SLOT);
    let before = vm.run(&fingerprint)?;
    let (text, code) = install_from(vm, bench, "other-seal", false)?;
    ensure(
        code == 2 && text.contains("recovery key"),
        format!("{code} {text}"),
    )?;
    ensure(
        vm.run(&fingerprint)? == before,
        "a refused update wrote to the disk",
    )
}

/// After a start of `version` that must not open the disk: checks it did not, then waits for the machine
/// to go back by itself to the first version, which opens it.
fn locked_then_back(vm: &mut Vm, bench: &Bench, version: &str) -> Result<(), String> {
    wait_version(vm, version, RESTART_LIMIT)?;
    ensure(
        !disk_opened(vm)?,
        "the disk opened for a start that must not open it",
    )?;
    let started = Instant::now();
    wait_version(vm, &bench.first, ROLLBACK_LIMIT)?;
    say(&format!(
        "      back by itself after {:.0}s",
        started.elapsed().as_secs_f32()
    ));
    vm.wait_for_server()?;
    ensure(disk_opened(vm)?, "the old version did not open the disk")
}

/// Requirement 6: gets past the updater by hand, as a bug might. The new version stops at the recovery key
/// prompt with `/var` locked, nobody answers, and the machine returns to a version that opens the disk.
pub(crate) fn seal_prompt_rolls_back(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    install_ok(vm, bench, NEXT.0, false)?;
    vm.run(&format!(
        "curl -sS --cacert /var/lib/medbrains-settings/update-ca.pem -o /boot/EFI/Linux/medbrains-os_{}+1-0.efi {}/boot.efi; sync",
        NEXT.1,
        url(bench, "other-seal")
    ))?;
    vm.reboot()?;
    locked_then_back(vm, bench, NEXT.1)
}

/// The rollback floor (`OS-KEYS.md`): a system signed with our keys whose rollback number is below the
/// floor gets no TPM unlock. Installing raised the floor to the running version's number; the bundle's
/// system is older, so its start asks for the recovery key, nobody answers, and the machine goes back.
pub(crate) fn floor_refuses_older_system(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    install_ok(vm, bench, LOW_ROLLBACK.0, false)?;
    ask_restart(vm, "apply")?;
    locked_then_back(vm, bench, LOW_ROLLBACK.1)
}

/// The loader command-line gap (`OS-VERITY.md`): a loader entry added to the boot partition, starting our
/// boot file with a foreign `roothash=`, does not start a foreign system with the disk open. With Secure
/// Boot the boot file ignores the loader's command line; and the updater refuses to touch a boot partition
/// holding an entry it did not put there.
pub(crate) fn added_entry_is_ignored(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let genuine = booted_roothash(vm)?;
    let running = vm.run(
        "bootctl list --no-pager | awk '/\\(selected\\)/ {s=1} s && /source:/ {print $2; exit}'",
    )?;
    let file = running.rsplit('/').next().unwrap_or_default().to_owned();
    ensure(
        file.ends_with(".efi"),
        format!("no running boot file: {running}"),
    )?;
    vm.run(&format!(
        "mkdir -p /boot/loader/entries; printf 'title Added\\nefi /EFI/Linux/{file}\\noptions root=/dev/mapper/root ro roothash={FOREIGN_ROOTHASH}\\n' \
         > /boot/loader/entries/added.conf; sync; bootctl set-oneshot added.conf"
    ))?;
    vm.reboot()?;
    let booted = booted_roothash(vm)?;
    ensure(
        booted == genuine,
        format!("the added entry's root hash was used: {booted}"),
    )?;
    vm.wait_for_server()?;
    ensure(disk_opened(vm)?, "the genuine system did not open the disk")?;
    let (text, code) = install_from(vm, bench, NEXT.0, false)?;
    ensure(
        code != 0 && text.contains("not the one this machine put there"),
        format!("an install went on past an added loader entry: {code} {text}"),
    )?;
    vm.run("rm /boot/loader/entries/added.conf; sync")?;
    install_ok(vm, bench, NEXT.0, true).map(drop)
}
