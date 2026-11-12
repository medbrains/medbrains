//! What a proven version does when its sealed system is damaged, and what guards the boot partition
//! (`docs/architecture/OS-VERITY.md`, `OS-UPDATES.md`). The damage is made from inside the machine, by
//! writing one byte to the running slot's own partition, under dm-verity, as a failing disk or someone
//! with root would.

use std::thread::sleep;
use std::time::Duration;

use crate::update_steps::{NEXT, RESTART_LIMIT, apply_and_prove, install_from, install_ok};
use crate::updates::{Bench, ensure, open_mirror, status, wait_status, wait_version};
use crate::vm::Vm;

/// A file nothing reads at start or while the machine works: damaging it shows only when it is read.
const IDLE_FILE: &str = "/usr/share/zoneinfo/Antarctica/Troll";
/// Read at every start, so damaging it is found by the seal check at start.
const START_FILE: &str = "/usr/lib/os-release";
const BOOT_ID: &str = "cat /proc/sys/kernel/random/boot_id";
/// Long enough for udev to start the running check and for it to write the record.
const ALERT_LIMIT: Duration = Duration::from_secs(60);

/// Installs and proves the next version, so the machine runs a proven version with an earlier one
/// behind it that left the same database schema.
fn run_proven_next(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    install_ok(vm, bench, NEXT.0, false)?;
    apply_and_prove(vm, bench, NEXT.1)?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)
}

/// Changes the first byte of `file`'s first block on the running slot's own partition, under dm-verity.
fn damage(vm: &mut Vm, file: &str) -> Result<(), String> {
    let done = vm.run(&format!(
        "dev=$(veritysetup status root | awk '/data device:/ {{print $3}}'); \
         blk=$(debugfs -R 'bmap {file} 0' $dev 2>/dev/null); \
         bs=$(dumpe2fs -h $dev 2>/dev/null | awk '/^Block size:/ {{print $3}}'); \
         printf J | dd of=$dev bs=1 seek=$((blk * bs)) conv=notrunc status=none && sync && echo damaged $blk"
    ))?;
    ensure(
        done.starts_with("damaged "),
        format!("could not damage {file}: {done}"),
    )
}

/// Requirement (review M1): a block of a proven, running version that fails its check is said loudly and
/// recorded, and nothing restarts; the next start goes back to the earlier version, as a damaged slot,
/// not a failed version.
pub(crate) fn damage_in_use_waits_for_a_restart(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    run_proven_next(vm, bench)?;
    let id = vm.run(BOOT_ID)?;
    damage(vm, IDLE_FILE)?;
    vm.run(&format!(
        "echo 3 > /proc/sys/vm/drop_caches; cat {IDLE_FILE} > /dev/null 2>&1; true"
    ))?;
    let value = wait_status(vm, &["stage"], "idle", ALERT_LIMIT)?;
    let mut alarm = value["alarm"].as_str().unwrap_or("").to_owned();
    for _ in 0..20 {
        if !alarm.is_empty() {
            break;
        }
        sleep(Duration::from_secs(3));
        alarm = status(vm)?["alarm"].as_str().unwrap_or("").to_owned();
    }
    ensure(
        alarm.contains("seal check"),
        format!("no alarm on the screen: {}", status(vm)?),
    )?;
    sleep(Duration::from_secs(10));
    ensure(
        vm.run(BOOT_ID)? == id,
        "a seal failure restarted a machine in use",
    )?;
    let record = vm.run("cat /var/lib/medbrains/update/state.json")?;
    ensure(
        record.contains("\"damaged\": {"),
        format!("no damaged slot recorded: {record}"),
    )?;
    vm.reboot()?;
    wait_version(vm, &bench.first, RESTART_LIMIT)?;
    let value = wait_status(vm, &["stage"], "idle", RESTART_LIMIT)?;
    let words = value["last"]["words"].as_str().unwrap_or("");
    ensure(
        words.contains("seal check"),
        format!("the record says: {value}"),
    )?;
    let record = vm.run("cat /var/lib/medbrains/update/state.json")?;
    ensure(
        !failed_list(&record).contains(NEXT.1),
        format!("the damaged version was recorded as failed: {record}"),
    )
}

/// The `failed` list of a record, as text.
fn failed_list(record: &str) -> String {
    record
        .split_once("\"failed\": [")
        .and_then(|(_, rest)| rest.split_once(']'))
        .map_or_else(String::new, |(list, _)| list.to_owned())
}

/// Requirement (review M4): damage the seal check finds at start, before the data disk is open, is noted
/// on the boot partition, recorded once the record can be written, and acted on: the machine goes back.
pub(crate) fn damage_at_start_is_recorded(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    run_proven_next(vm, bench)?;
    damage(vm, START_FILE)?;
    vm.reboot()?;
    wait_version(vm, &bench.first, RESTART_LIMIT)?;
    let value = wait_status(vm, &["stage"], "idle", RESTART_LIMIT)?;
    let words = value["last"]["words"].as_str().unwrap_or("");
    ensure(
        words.contains("seal check"),
        format!("the record says: {value}"),
    )?;
    let note = vm.run("ls /boot/medbrains-seal-failed.json 2>/dev/null; true")?;
    ensure(
        note.is_empty(),
        "the note on the boot partition was not removed",
    )?;
    let audit = vm.run(
        "journalctl -b -1 -t medbrains-os-update --no-pager -p crit | grep -c medbrains-seal; true",
    )?;
    ensure(audit != "0", "no audit line in the journal")
}

/// Requirement (review M2): a boot file on the boot partition that is not what this machine put there
/// stops an install before anything is deleted, and a staged boot file changed while waiting is not
/// applied.
pub(crate) fn boot_files_are_checked(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let running = vm.run(&format!(
        "ls /boot/EFI/Linux/medbrains-os_{}*.efi",
        bench.first
    ))?;
    ensure(
        running.ends_with(".efi"),
        format!("no running boot file: {running}"),
    )?;
    let size = vm.run(&format!("stat -c %s '{running}'"))?;
    vm.run(&format!("printf x >> '{running}'"))?;
    let (text, code) = install_from(vm, bench, NEXT.0, false)?;
    vm.run(&format!("truncate -s {size} '{running}'"))?;
    ensure(
        code != 0 && text.contains("not the one this machine put there"),
        format!("an install went on past a changed boot file: {code} {text}"),
    )?;
    install_ok(vm, bench, NEXT.0, true)?;
    let id = vm.run(BOOT_ID)?;
    vm.run(&format!("printf x >> /boot/EFI/MedBrains/{}.efi", NEXT.1))?;
    let applied = vm.run("medbrains-os-update apply 2>&1; echo code $?")?;
    ensure(
        applied.contains("no longer matches") && !applied.ends_with("code 0"),
        format!("a changed staged boot file was applied: {applied}"),
    )?;
    ensure(vm.run(BOOT_ID)? == id, "the machine restarted")?;
    let value = status(vm)?;
    ensure(value["stage"] == "idle", format!("{value}"))
}
