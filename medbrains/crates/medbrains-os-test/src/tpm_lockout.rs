//! The TPM's dictionary-attack lockout (`docs/architecture/OS-KEYS.md`, "TPM lockout"). A PIN-sealed disk key
//! counts every wrong PIN, and the TPM also counts every power cut after the key was used, so a site with
//! power cuts needs limits with room in them, a plain screen when the chip locks out, and a way for IT to
//! lift it with the recovery key.

use std::path::Path;
use std::thread::sleep;

use crate::disk::{
    NOTICE, RECORD, SCREEN_LIMIT, SETTLE, throwaway_pin, wait_disk_step_done, wait_open,
};
use crate::ensure;
use crate::vm::{OWN_TPM, Vm, scaled};

/// What disk-setup sets: 16 failures, one forgiven every 300 s, the lockout password path shut for 600 s.
const LIMITS: [(&str, &str); 3] = [
    ("TPM2_PT_MAX_AUTH_FAIL", "0x10"),
    ("TPM2_PT_LOCKOUT_INTERVAL", "0x12C"),
    ("TPM2_PT_LOCKOUT_RECOVERY", "0x258"),
];
const GETCAP: &str = "TPM2TOOLS_TCTI=device:/dev/tpmrm0 tpm2_getcap properties-variable";
/// Power cuts after a PIN unlock. The TPM 2.0 reference code counts each as a failure.
const POWER_CUTS: u32 = 3;
/// Drives the TPM into lockout with a throwaway PIN-protected object, never the disk's own key.
const TRIP_LOCKOUT: &str = "export TPM2TOOLS_TCTI=device:/dev/tpmrm0; cd /run; tpm2_createprimary -Q -C o -c os-test-p.ctx && printf x | tpm2_create -Q -C os-test-p.ctx -p right -i- -u os-test.pub -r os-test.priv && tpm2_load -Q -C os-test-p.ctx -u os-test.pub -r os-test.priv -c os-test.ctx && for i in $(seq 20); do tpm2_unseal -Q -c os-test.ctx -p wrong >/dev/null 2>&1; done; rm -f os-test-p.ctx os-test.pub os-test.priv os-test.ctx";

/// The value of one TPM property, as `tpm2_getcap` prints it.
fn property(vm: &mut Vm, name: &str) -> Result<String, String> {
    let line = vm.run(&format!("{GETCAP} | grep -m1 -E '^ *{name}:'"))?;
    Ok(line.split(':').nth(1).unwrap_or_default().trim().to_owned())
}

/// After setup the TPM has our lockout limits and a lockout password, so nobody without the recovery key
/// can reset its failure count.
pub(crate) fn limits_are_ours(vm: &mut Vm, _: &Path) -> Result<(), String> {
    for (name, want) in LIMITS {
        let got = property(vm, name)?;
        ensure(
            got.eq_ignore_ascii_case(want),
            format!("{name} is {got}, not {want}"),
        )?;
    }
    let set = property(vm, "lockoutAuthSet")?;
    ensure(
        set == "1",
        format!("no lockout password: lockoutAuthSet is {set}"),
    )
}

/// IT lifts a real lockout with the recovery key, and a wrong key changes nothing.
pub(crate) fn it_lifts_a_lockout(vm: &mut Vm, _: &Path) -> Result<(), String> {
    vm.run(TRIP_LOCKOUT)?;
    ensure(
        property(vm, "inLockout")? == "1",
        "the TPM did not lock out",
    )?;
    let wrong = vm.run("printf %s not-the-key > /run/os-test-key; /usr/lib/medbrains/disk-setup clear-lockout /run/os-test-key >/dev/null 2>&1; echo $?")?;
    ensure(wrong != "0", "a wrong key lifted the lockout")?;
    let key = vm.recovery_key.clone();
    let done = vm.run(&format!("printf %s '{key}' > /run/os-test-key; /usr/lib/medbrains/disk-setup clear-lockout /run/os-test-key >/dev/null 2>&1; echo $?; rm -f /run/os-test-key"))?;
    ensure(done == "0", format!("clear-lockout ended with {done}"))?;
    ensure(
        property(vm, "inLockout")? == "0",
        "still in lockout after the recovery key",
    )
}

/// Types the PIN at the disk's prompt on this start and waits for the disk to open.
fn open_with_pin(vm: &mut Vm, pin: &str) -> Result<(), String> {
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    vm.type_text(&format!("{pin}\n"))?;
    wait_open(vm)
}

/// Power cuts after PIN unlocks, then one wrong PIN, and the right PIN still opens: the limits leave room
/// for a site with an unsteady supply. Not yet shown to fail without the fix: in its first run the count
/// was 1 after three cuts, which forgiveness (one per 300 s) may have hidden. Prints the count.
pub(crate) fn power_cuts_and_a_wrong_pin_leave_the_pin_working(image: &Path) -> Result<(), String> {
    let mut vm = Vm::start_answering_key(image)?;
    let pin = throwaway_pin()?;
    vm.type_text(&format!("{pin}\n"))?;
    sleep(SETTLE);
    vm.type_text(&format!("{pin}\n"))?;
    wait_disk_step_done(&mut vm)?;
    let record = vm.run(&format!("cat {RECORD}"))?;
    ensure(record == "encrypted-tpm2-pin", record)?;
    let disk = vm.disk();
    for _ in 0..POWER_CUTS {
        vm.cut_power()?;
        vm.boot(&disk, Some(OWN_TPM))?;
        open_with_pin(&mut vm, &pin)?;
    }
    vm.cut_power()?;
    vm.boot(&disk, Some(OWN_TPM))?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    vm.type_text("wrongpin\n")?;
    sleep(scaled(SETTLE));
    vm.type_text(&format!("{pin}\n"))?;
    wait_open(&mut vm)?;
    let counter = property(&mut vm, "TPM2_PT_LOCKOUT_COUNTER")?;
    drop(std::io::Write::write_all(
        &mut std::io::stderr(),
        format!("      TPM failure count after {POWER_CUTS} cuts and a wrong PIN: {counter}\n")
            .as_bytes(),
    ));
    ensure(property(&mut vm, "inLockout")? == "0", "in lockout")
}
