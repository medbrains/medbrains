//! Updates on a sealed system partition (`docs/architecture/OS-VERITY.md`): a slot whose system does not
//! match its boot file's root hash is never named, and one changed after it was written never runs.

use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::update_steps::{NEXT, ROLLBACK_LIMIT, SLOT, ask_restart, install_from, install_ok};
use crate::updates::{
    Bench, ensure, open_mirror, same_var, say, var_snapshot, wait_status, wait_version,
};
use crate::vm::Vm;

/// A signed bundle whose system is not the one its boot file seals: a release built wrong.
const UNSEALED: (&str, &str) = ("unsealed", "1.0.6");
const RESTART_LIMIT: Duration = Duration::from_secs(300);

/// Requirement: a slot is named only once its system matches the seal. The check reads the whole slot,
/// so the bundle passes every signature and hash and is stopped there, with the slot left nameless.
pub(crate) fn unsealed_never_named(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let (text, code) = install_from(vm, bench, UNSEALED.0, true)?;
    ensure(
        code != 0 && text.contains("does not match the seal"),
        format!("{code} {text}"),
    )?;
    let labels = vm.run("lsblk -nro PARTLABEL /dev/vda")?;
    ensure(
        !labels.contains(UNSEALED.1) && labels.contains("_empty"),
        format!("the slot was named: {labels}"),
    )?;
    let staged = vm.run("ls /boot/EFI/MedBrains /boot/EFI/Linux 2>/dev/null")?;
    ensure(
        !staged.contains(UNSEALED.1),
        format!("a boot file was left: {staged}"),
    )
}

/// Requirement: a byte changed in an installed slot, as someone with the disk in their hands could, stops
/// the new version before its system runs; the loader's count then brings the old version back.
pub(crate) fn changed_slot_rolls_back(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let before = var_snapshot(vm)?;
    install_ok(vm, bench, NEXT.0, true)?;
    let marker = format!("IMAGE_VERSION=\"{}\"", NEXT.1);
    let flipped = vm.run_for(
        &format!(
            "s={SLOT}; at=$(grep -abo -m1 '{marker}' $s | cut -d: -f1); \
             printf J | dd of=$s bs=1 seek=$at conv=notrunc status=none && sync && echo $at"
        ),
        Duration::from_secs(300),
    )?;
    ensure(
        flipped.parse::<u64>().is_ok(),
        format!("no byte changed: {flipped}"),
    )?;
    say(&format!(
        "      changed one byte at {flipped} of the new slot"
    ));
    ask_restart(vm, "apply")?;
    let started = Instant::now();
    sleep(Duration::from_secs(20));
    let took = wait_version(vm, &bench.first, ROLLBACK_LIMIT)?;
    say(&format!(
        "      back by itself after {:.0}s",
        started.elapsed().max(took).as_secs_f32()
    ));
    wait_status(vm, &["last", "result"], "rolled_back", RESTART_LIMIT)?;
    // The loader really started it and used its starts up: an entry never tried would still say +3-0.
    let entries = vm.run("ls /boot/EFI/Linux")?;
    ensure(
        entries.contains(&format!("{}+0-", NEXT.1)),
        format!("the new version was never started: {entries}"),
    )?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    same_var(&before, &var_snapshot(vm)?)
}
