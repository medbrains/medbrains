//! Updates on a sealed data disk (`OS-UPDATES.md`, "The sealed data disk"), which needs a TPM the guest can
//! use, so these run on x86-64 with swtpm. Requirement 6: no recovery key by surprise.

use std::time::Instant;

use crate::update_steps::{
    FINGERPRINT, NEXT, RESTART_LIMIT, ROLLBACK_LIMIT, SLOT, apply_and_prove, ask_restart,
    install_from, install_ok,
};
use crate::updates::{Bench, ensure, same_var, say, url, var_snapshot, wait_version};
use crate::vm::Vm;

/// True if the data disk opened through its encrypted mapping.
fn disk_opened(vm: &mut Vm) -> Result<bool, String> {
    Ok(vm
        .run("findmnt -no SOURCE /var")?
        .contains("/dev/mapper/medbrains-data"))
}

/// Requirement 6: the boot chain changes twice, and nobody types anything either time.
pub(crate) fn sealed_update(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
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

/// Requirement 6: an update that would ask for the recovery key by surprise is never installed.
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
    wait_version(vm, NEXT.1, RESTART_LIMIT)?;
    ensure(!disk_opened(vm)?, "the wrong key opened the disk")?;
    let started = Instant::now();
    wait_version(vm, &bench.first, ROLLBACK_LIMIT)?;
    say(&format!(
        "      back by itself after {:.0}s",
        started.elapsed().as_secs_f32()
    ));
    vm.wait_for_server()?;
    ensure(disk_opened(vm)?, "the old version did not open the disk")
}
