//! Fail-closed checks of the data disk seal (`docs/architecture/OS-KEYS.md`, "Binding to the signed boot
//! image", "Rollback floor"): each one shows that the disk stays locked, or keeps PCR 4, when what the
//! seal relies on is missing. x86-64 with swtpm only, like the other sealed scenarios.

use std::thread::sleep;
use std::time::Duration;

use crate::update_steps::RESTART_LIMIT;
use crate::updates::{Bench, ensure, say};
use crate::vm::{self, Vm};

const PART: &str = "/dev/disk/by-partlabel/medbrains-data";
const FLOOR_INDEX: &str = "0x01004d42";
const FLOOR_UNIT: &str = "medbrains-disk-floor.service";
const UNLOCK_UNIT: &str = "'systemd-cryptsetup@medbrains\\x2ddata.service'";
/// Read by the debug image's drop-in for the floor unit (`os/debug/90-medbrains-debug-floor.conf`).
const FAIL_FLOOR_FLAG: &str = "/boot/medbrains-debug-fail-floor";
/// How long units get to settle after a start before their state is read.
const SETTLE: Duration = Duration::from_secs(20);

/// True if the data disk opened through its encrypted mapping.
fn disk_opened(vm: &mut Vm) -> Result<bool, String> {
    Ok(vm
        .run("findmnt -no SOURCE /var")?
        .contains("/dev/mapper/medbrains-data"))
}

/// The floor counter's value, or `None` if it can't be read.
fn floor(vm: &mut Vm) -> Result<Option<u64>, String> {
    let hex = vm.run(&format!(
        "tpm2_nvread -C o -s 8 {FLOOR_INDEX} 2>/dev/null | od -An -tx1 | tr -d ' \\n'"
    ))?;
    Ok(u64::from_str_radix(&hex, 16).ok())
}

/// The floor check's verdict for a system numbered `rollback`, without restarting: the same script the
/// unlock requires, given a stand-in os-release. True if it refused.
fn refuses(vm: &mut Vm, rollback: u64) -> Result<bool, String> {
    let said = vm.run(&format!(
        "printf 'MEDBRAINS_ROLLBACK=%s\\n' {rollback} > /run/mb-release; \
         MEDBRAINS_OS_RELEASE=/run/mb-release /usr/lib/medbrains/disk-setup floor-check 2>&1; true"
    ))?;
    Ok(said.contains("will ask for its recovery key"))
}

/// The seal keeps PCR 4 unless the firmware trusts our key alone. With QEMU's empty variables the image
/// enrols only its own certificate, so the disk is sealed to PCR 7; with `MB_OS_TEST_VARS` holding a db
/// that also trusts a vendor, it must be PCR 4+7. Read from the enrolled token itself.
pub(crate) fn seal_matches_trusted_keys(vm: &mut Vm, _: &Bench) -> Result<(), String> {
    let token = vm.run(&format!(
        "cryptsetup luksDump {PART} | grep -E 'tpm2-hash-pcrs|tpm2-pubkey:'"
    ))?;
    let pcrs = token
        .lines()
        .find_map(|line| line.trim().strip_prefix("tpm2-hash-pcrs:"))
        .map(str::trim)
        .unwrap_or_default()
        .to_owned();
    let want = if vm::preset_vars() { "4+7" } else { "7" };
    say(&format!(
        "      enrolled tpm2-hash-pcrs {pcrs}, firmware preset {}",
        vm::preset_vars()
    ));
    ensure(
        pcrs == want,
        format!("sealed to {pcrs}, expected {want}: {token}"),
    )?;
    ensure(
        token.contains("tpm2-pubkey"),
        "the seal has no signed PCR 11 policy",
    )
}

/// The floor can't be lowered from the running system: deleting the counter leaves no floor, which the
/// check refuses; defining it again starts at or above the old value; clearing the TPM leaves a disk that
/// does not open by itself. Measured on swtpm; a real TPM is not tested here.
pub(crate) fn floor_counter_cannot_be_lowered(vm: &mut Vm, _: &Bench) -> Result<(), String> {
    let before = floor(vm)?.ok_or("no floor on a sealed machine")?;
    ensure(before >= 1, "the floor is zero")?;
    ensure(!refuses(vm, before)?, "the running version is refused")?;
    ensure(refuses(vm, before - 1)?, "an older number was not refused")?;
    vm.run(&format!("tpm2_nvundefine -C o {FLOOR_INDEX}"))?;
    ensure(
        floor(vm)?.is_none(),
        "the floor is still there after deleting it",
    )?;
    ensure(refuses(vm, before)?, "a missing floor was not refused")?;
    vm.run(&format!(
        "tpm2_nvdefine {FLOOR_INDEX} -C o -s 8 -a 'nt=counter|ownerwrite|ownerread' && tpm2_nvincrement -C o {FLOOR_INDEX}"
    ))?;
    let again = floor(vm)?.ok_or("the counter could not be defined again")?;
    say(&format!(
        "      floor {before}, after delete and define again {again}"
    ));
    ensure(
        again >= before,
        format!("a new counter started lower: {again} < {before}"),
    )?;
    ensure(
        refuses(vm, before - 1)?,
        "an older number opens after the counter was redefined",
    )?;
    vm.run("tpm2_clear -c l")?;
    vm.reboot()?;
    sleep(SETTLE);
    ensure(
        !disk_opened(vm)?,
        "the disk opened by itself after the TPM was cleared",
    )
}

/// A floor check that fails keeps the disk locked: the unlock requires it, so it does not run at all.
/// The debug image's drop-in makes the check fail while a flag file is on the boot partition.
pub(crate) fn failed_floor_check_keeps_disk_locked(vm: &mut Vm, _: &Bench) -> Result<(), String> {
    vm.run(&format!("touch {FAIL_FLOOR_FLAG}; sync"))?;
    vm.reboot()?;
    sleep(vm::scaled(SETTLE));
    let floor_state = vm.run(&format!("systemctl is-failed {FLOOR_UNIT}; true"))?;
    let unlock_state = vm.run(&format!("systemctl is-active {UNLOCK_UNIT}; true"))?;
    say(&format!(
        "      floor unit {floor_state}, unlock unit {unlock_state}"
    ));
    ensure(
        floor_state == "failed",
        format!("the floor unit is {floor_state}"),
    )?;
    ensure(
        unlock_state != "active",
        "the unlock ran after its floor check failed",
    )?;
    ensure(
        !disk_opened(vm)?,
        "the disk opened after its floor check failed",
    )?;
    vm.run(&format!("rm -f {FAIL_FLOOR_FLAG}; sync"))?;
    vm.force_reboot()?;
    let started = std::time::Instant::now();
    while started.elapsed() < vm::scaled(RESTART_LIMIT) && !disk_opened(vm)? {
        sleep(SETTLE);
    }
    ensure(
        disk_opened(vm)?,
        "without the flag the disk did not open by itself",
    )
}
