//! The data disk (`docs/architecture/OS-KEYS.md`): what a copied disk, the recovery key, a normal
//! restart and a missing TPM each do. Steps depend on the ones before, so a scenario stops at its first
//! failure. The recovery key is read off the machine's screen and typed back, and is never printed.

use std::path::Path;
use std::process::Command;
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::vm::{KEYBOARD_READY, NO_TPM_QUESTION, OWN_TPM, Vm, scaled, tpm_usable};

const PARTITION: &str = "/dev/disk/by-partlabel/medbrains-data";
const MAPPED: &str = "/dev/mapper/medbrains-data";
const RECORD: &str = "/var/lib/medbrains/config/disk-protection";
const MARKER_FILE: &str = "/var/lib/medbrains/config/os-test-marker";
/// Written only to the encrypted partition: must not be found on the raw disk. Written in two parts,
/// so the command that writes it cannot put the whole text on the disk through shell history.
const SECRET_MARKER: &str = "MBOSTESTSECRETMARKER7Q2";
const SECRET_MARKER_PARTS: (&str, &str) = ("MBOSTESTSECRET", "MARKER7Q2");
/// Written to the unencrypted system partition: must be found, or the search proves nothing.
const CONTROL_MARKER: &str = "MBOSTESTPLAINCONTROL7Q2";
const OTHER_TPM: &str = "tpm-other";
const NOTICE: &str = "did not open by itself";
const SCREEN_LIMIT: Duration = Duration::from_secs(120);
const OPEN_LIMIT: Duration = Duration::from_secs(60);
const SETTLE: Duration = Duration::from_secs(8);
const REPLAY_LIMIT: Duration = Duration::from_secs(120);
/// After this many wrong answers to the PIN prompt, systemd asks for the recovery key instead.
const WRONG_PINS_BEFORE_KEY: u32 = 2;
const MANY_WRONG_PINS: u32 = 34;
const RECOVERY_PROMPT: &str = "enter recovery key";

type Step = (&'static str, fn(&mut Vm, &Path) -> Result<(), String>);
type NewMachineStep = (&'static str, fn(&Path) -> Result<(), String>);

/// Fails with `message` unless `ok`.
fn ensure(ok: bool, message: impl Into<String>) -> Result<(), String> {
    if ok { Ok(()) } else { Err(message.into()) }
}

/// True if the bytes of `text` occur anywhere in `file`.
fn found_in_file(file: &Path, text: &str) -> Result<bool, String> {
    let done = Command::new("grep")
        .args(["-a", "-q", "-F", text])
        .arg(file)
        .status()
        .map_err(|e| e.to_string())?;
    match done.code() {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        other => Err(format!("grep ended with {other:?}")),
    }
}

/// True if the data disk is open and mounted on `/var`.
fn data_open(vm: &mut Vm) -> Result<bool, String> {
    Ok(vm.run("findmnt -no SOURCE /var")?.contains(MAPPED))
}

/// Waits for the data disk to open with nothing typed or something typed earlier.
fn wait_open(vm: &mut Vm) -> Result<(), String> {
    let deadline = Instant::now() + scaled(OPEN_LIMIT);
    while Instant::now() < deadline {
        if data_open(vm)? {
            return Ok(());
        }
        sleep(Duration::from_secs(2));
    }
    let detail = vm.run("systemd-analyze pcrs 7 11 12 --no-pager | cut -c1-44; journalctl -b -u 'systemd-cryptsetup@medbrains\\x2ddata' -o cat --no-pager | cut -c1-140 | tail -6")?;
    Err(format!("the data disk did not open:\n{detail}"))
}

/// Waits for the data disk step to finish, which comes before the setup screen.
fn wait_disk_step_done(vm: &mut Vm) -> Result<(), String> {
    let deadline = Instant::now() + scaled(SCREEN_LIMIT);
    while Instant::now() < deadline {
        if vm.run(&format!("test -e {RECORD}; echo $?"))? == "0" {
            return Ok(());
        }
        sleep(Duration::from_secs(2));
    }
    Err("the data disk step did not finish".to_owned())
}

/// The data disk is mounted through LUKS2, sealed to the TPM, with a recovery key and no empty key.
fn sealed_with_recovery_key(vm: &mut Vm, _: &Path) -> Result<(), String> {
    ensure(data_open(vm)?, "/var is not on the encrypted disk")?;
    let slots = vm.run(&format!("systemd-cryptenroll {PARTITION}"))?;
    ensure(
        slots.contains("tpm2") && slots.contains("recovery"),
        slots.clone(),
    )?;
    ensure(
        !slots.contains("password"),
        format!("an extra key slot: {slots}"),
    )?;
    let header = vm.run(&format!("cryptsetup luksDump {PARTITION}"))?;
    let is_luks2 = header
        .lines()
        .any(|line| line.split_whitespace().eq(["Version:", "2"]));
    ensure(
        is_luks2 && header.contains("aes-xts-plain64"),
        "not LUKS2 AES-XTS",
    )?;
    let record = vm.run(&format!("cat {RECORD}"))?;
    ensure(record == "encrypted-tpm2", record)
}

/// The recovery key stayed off the journal.
fn recovery_key_not_logged(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let group = vm
        .recovery_key
        .rsplit('-')
        .next()
        .unwrap_or_default()
        .to_owned();
    ensure(!group.is_empty(), "no recovery key was read")?;
    let count = vm.run(&format!("journalctl -b --no-pager | grep -c {group}; true"))?;
    ensure(
        count == "0",
        format!("{count} journal lines hold the recovery key"),
    )
}

/// A raw copy holds neither the secret marker nor the key file, while the plaintext control is found.
fn raw_disk_shows_nothing(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let (first, second) = SECRET_MARKER_PARTS;
    vm.run(&format!("printf '%s%s\\n' {first} {second} > {MARKER_FILE}; echo {CONTROL_MARKER} > /root/control; sync"))?;
    let jwt = vm.run("sed -n 's/^JWT_PRIVATE_KEY=//p' /etc/medbrains/env")?;
    ensure(jwt.len() > 16, "could not read the JWT key to look for")?;
    vm.shut_down()?;
    let disk = vm.disk();
    ensure(
        found_in_file(&disk, CONTROL_MARKER)?,
        "the plaintext control was not found: this search proves nothing",
    )?;
    ensure(
        !found_in_file(&disk, SECRET_MARKER)?,
        "the secret marker is readable on the raw disk",
    )?;
    ensure(
        !found_in_file(&disk, &jwt)?,
        "the JWT key is readable on the raw disk",
    )?;
    ensure(
        !found_in_file(&disk, &vm.recovery_key.clone())?,
        "the recovery key is on the raw disk",
    )
}

/// A copy of the disk, on a machine with a different TPM, stays locked and says why.
fn copy_stays_locked(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let copy = vm.scratch_path("copy.qcow2");
    std::fs::copy(vm.disk(), &copy).map_err(|e| e.to_string())?;
    vm.boot(&copy, Some(OTHER_TPM))?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    ensure(!data_open(vm)?, "the copy opened by itself")?;
    let mapped = vm.run(&format!("test -e {MAPPED}; echo $?"))?;
    ensure(mapped == "1", "the copy is mapped")
}

/// A wrong key leaves it locked and the prompt still there.
fn wrong_key_refused(vm: &mut Vm, _: &Path) -> Result<(), String> {
    vm.type_text("abcdefgh-abcdefgh\n")?;
    sleep(SETTLE);
    ensure(!data_open(vm)?, "a wrong key opened the disk")
}

/// The recovery key typed on the screen opens the copy, with the data in it.
fn recovery_key_opens_copy(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let key = vm.recovery_key.clone();
    vm.type_text(&format!("{key}\n"))?;
    wait_open(vm)?;
    let marker = vm.run(&format!("cat {MARKER_FILE}"))?;
    ensure(marker == SECRET_MARKER, marker)
}

/// After a move to new hardware, sealing to its TPM makes it open by itself again.
fn reseal_to_new_tpm(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let key = vm.recovery_key.clone();
    let done = vm.run(&format!("umask 077; printf %s {key} > /run/k; /usr/lib/medbrains/disk-setup reseal /run/k >/dev/null 2>&1; echo $?; rm -f /run/k"))?;
    ensure(
        done == "0",
        format!("sealing to the new TPM returned {done}"),
    )?;
    vm.reboot()?;
    wait_open(vm)
}

/// The original disk and TPM open with no typing, from power off and on a restart, with data intact.
fn normal_restarts_need_no_typing(vm: &mut Vm, _: &Path) -> Result<(), String> {
    vm.shut_down()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    wait_open(vm)?;
    vm.reboot()?;
    wait_open(vm)?;
    let marker = vm.run(&format!("cat {MARKER_FILE}"))?;
    ensure(marker == SECRET_MARKER, marker)
}

/// The boot menu and editor are turned off in the loader's file.
fn boot_editor_off(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let conf = vm.run("cat /boot/loader/loader.conf")?;
    ensure(
        conf.lines()
            .any(|line| line.split_whitespace().eq(["editor", "no"])),
        conf,
    )
}

/// A changed boot file does not open the disk, where the image is signed; restored, it opens again.
fn changed_boot_file_stays_locked(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let signed = vm.run("test -e /run/systemd/tpm2-pcr-public-key.pem; echo $?")?;
    ensure(
        signed == "0",
        "the image is not signed, so this cannot be tested: debug images are",
    )?;
    let (from, to) = ("loglevel=3", "loglevel=4");
    let patch = |text: &str| {
        format!(
            "f=$(ls /boot/EFI/Linux/*.efi | head -1); o=$(grep -abo -m1 {text} \"$f\" | head -1 | cut -d: -f1)"
        )
    };
    vm.run(&format!(
        "{}; printf %s {to} | dd of=\"$f\" bs=1 seek=\"$o\" conv=notrunc 2>/dev/null; sync",
        patch(from)
    ))?;
    vm.reboot()?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    ensure(!data_open(vm)?, "a changed boot file opened the disk")?;
    vm.run(&format!(
        "{}; printf %s {from} | dd of=\"$f\" bs=1 seek=\"$o\" conv=notrunc 2>/dev/null; sync",
        patch(to)
    ))?;
    vm.force_reboot()?;
    wait_open(vm)
}

/// The attack in OS-KEYS.md: the stolen machine, its own TPM, an attacker's kernel with no boot file,
/// and PCR 11 extended by hand to the published values with the signature replayed. It must fail, and
/// the control proves why: the same replay opens a slot that leaves out PCR 4.
fn stolen_machine_replay_refused(vm: &mut Vm, image: &Path) -> Result<(), String> {
    vm.shut_down()?;
    let copy = vm.scratch_path("stolen.qcow2");
    std::fs::copy(vm.disk(), &copy).map_err(|e| e.to_string())?;
    vm.boot_bare_kernel(&copy, Some(OWN_TPM), image)?;
    vm.run("mkdir -p /mnt/esp; mount -o ro /dev/disk/by-partlabel/esp /mnt/esp")?;
    let limit = scaled(REPLAY_LIMIT);
    let attack = vm.run_for(
        &format!(
            "/usr/lib/medbrains/pcr11-replay /mnt/esp/EFI/Linux/*.efi {PARTITION} 2>&1 | tail -6"
        ),
        limit,
    )?;
    ensure(
        attack.contains("REFUSED"),
        format!("the replay opened the disk: {attack}"),
    )?;
    let key = vm.recovery_key.clone();
    let control = vm.run_for(
        &format!(
            "umask 077; printf %s {key} > /run/k; systemd-cryptenroll --unlock-key-file=/run/k --tpm2-device=auto --tpm2-pcrs=7 \
             --tpm2-public-key=/run/pcr-public-key.pem --tpm2-public-key-pcrs=11 --tpm2-signature=/run/pcr-signature.json --wipe-slot=tpm2 {PARTITION} 2>&1 | tail -2; rm -f /run/k; \
             systemd-cryptsetup attach replay-control {PARTITION} none luks,tpm2-device=auto,tpm2-signature=/run/pcr-signature.json,headless=yes,tries=1 2>&1 | tail -2; echo control=${{PIPESTATUS[0]}}"
        ),
        limit,
    )?;
    ensure(
        control.contains("control=0"),
        format!("the replay itself is broken, so REFUSED proves nothing: {control}"),
    )?;
    vm.cut_power()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    wait_open(vm)
}

/// Known gap, kept visible: a change to the unverified system partition still runs with the disk open.
/// When verity lands this must start failing, and be turned around.
fn known_gap_system_partition_edit_opens(vm: &mut Vm, _: &Path) -> Result<(), String> {
    vm.run("touch /etc/os-test-attacker-file; sync")?;
    vm.reboot()?;
    wait_open(vm)?;
    let kept = vm.run("test -e /etc/os-test-attacker-file; echo $?")?;
    ensure(
        kept == "0",
        "the change did not survive, so verity may have landed: turn this test around",
    )
}

/// A sealed disk whose TPM has gone stays locked and says why.
fn missing_tpm_stays_locked(vm: &mut Vm, _: &Path) -> Result<(), String> {
    vm.shut_down()?;
    let disk = vm.disk();
    vm.boot(&disk, None)?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    ensure(!data_open(vm)?, "the disk opened with no TPM")
}

/// Destroying the LUKS header is the disposal path: afterwards even the recovery key opens nothing.
fn destroying_the_key_wipes_the_disk(vm: &mut Vm, _: &Path) -> Result<(), String> {
    let key = vm.recovery_key.clone();
    let before = vm.run(&format!(
        "printf %s {key} | cryptsetup open --test-passphrase --disable-external-tokens --key-file=- {PARTITION}; echo $?"
    ))?;
    ensure(
        before == "0",
        format!("the recovery key should open before the wipe: {before}"),
    )?;
    vm.run(&format!(
        "dd if=/dev/urandom of={PARTITION} bs=1M count=32 conv=fsync 2>/dev/null"
    ))?;
    let after = vm.run(&format!("printf %s {key} | cryptsetup open --test-passphrase --disable-external-tokens --key-file=- {PARTITION} 2>/dev/null; echo $?"))?;
    ensure(after != "0", "the recovery key still opened after the wipe")
}

/// A PIN for one throwaway machine, made fresh so none is written down anywhere.
fn throwaway_pin() -> Result<String, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    Ok(format!("pin{millis}"))
}

/// A PIN chosen at setup is asked at every start; a wrong one is refused; the right one opens.
fn pin_is_asked_at_every_start(image: &Path) -> Result<(), String> {
    let mut vm = Vm::start_answering_key(image)?;
    let pin = throwaway_pin()?;
    vm.type_text(&format!("{pin}\n"))?;
    sleep(SETTLE);
    vm.type_text(&format!("{pin}\n"))?;
    wait_disk_step_done(&mut vm)?;
    let record = vm.run(&format!("cat {RECORD}"))?;
    ensure(record == "encrypted-tpm2-pin", record)?;
    vm.shut_down()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    ensure(!data_open(&mut vm)?, "opened with no PIN")?;
    vm.type_text("wrongpin\n")?;
    sleep(scaled(SETTLE));
    ensure(!data_open(&mut vm)?, "opened with the wrong PIN")?;
    vm.type_text(&format!("{pin}\n"))?;
    wait_open(&mut vm)?;
    recovery_key_opens_a_pin_machine(&mut vm, &pin)
}

/// Answers the PIN prompt wrongly until the disk asks for the recovery key, at most two answers more than
/// systemd's own count, so a prompt that never changes fails instead of hanging.
fn answer_wrong_pins_until_key_asked(vm: &mut Vm) -> Result<(), String> {
    for _ in 0..WRONG_PINS_BEFORE_KEY + 2 {
        if vm.screen()?.contains(RECOVERY_PROMPT) {
            return Ok(());
        }
        vm.type_text("wrongpin\n")?;
        sleep(scaled(SETTLE));
    }
    vm.wait_for_screen(RECOVERY_PROMPT, scaled(SCREEN_LIMIT)).map(drop)
}

/// Past a PIN nobody knows: the first two answers go to the PIN prompt, and only then does the disk ask
/// for the recovery key. A key typed earlier is spent as a wrong PIN.
fn open_past_the_pin_with_recovery_key(vm: &mut Vm) -> Result<(), String> {
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    ensure(!data_open(vm)?, "opened with no PIN")?;
    answer_wrong_pins_until_key_asked(vm)?;
    let key = vm.recovery_key.clone();
    vm.type_text(&format!("{key}\n"))?;
    wait_open(vm)
}

/// A forgotten PIN does not lose the data: the recovery key opens the machine, also once wrong PINs have
/// tripped the TPM's lockout and it refuses even the right one. Many wrong answers in one boot reach the
/// TPM only twice.
fn recovery_key_opens_a_pin_machine(vm: &mut Vm, pin: &str) -> Result<(), String> {
    vm.shut_down()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    open_past_the_pin_with_recovery_key(vm)?;
    vm.shut_down()?;
    vm.boot(&disk, Some(OWN_TPM))?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    vm.type_text(&format!("{pin}\n"))?;
    sleep(scaled(SETTLE));
    if !data_open(vm)? {
        // Three wrong PINs so far trip swtpm's dictionary-attack lockout, and then the right PIN is
        // refused too, measured, and the PIN prompt comes back. The recovery key must still open it.
        answer_wrong_pins_until_key_asked(vm)?;
        let key = vm.recovery_key.clone();
        vm.type_text(&format!("{key}\n"))?;
    }
    wait_open(vm)?;
    vm.shut_down()?;
    vm.boot(&disk, Some(OWN_TPM))?;
    vm.wait_for_screen(NOTICE, scaled(SCREEN_LIMIT))?;
    for _ in 0..MANY_WRONG_PINS {
        vm.type_text("wrongpin\n")?;
        sleep(Duration::from_secs(4));
    }
    ensure(!data_open(vm)?, "wrong PINs opened the disk")?;
    let key = vm.recovery_key.clone();
    vm.type_text(&format!("{key}\n"))?;
    wait_open(vm)
}

/// A power cut after a PIN was sealed and before it was recorded: nobody can vouch for that PIN. The
/// saved recovery key gets back in, and the record ends up saying what the seal really is.
fn power_cut_during_pin_setup_recovers(image: &Path) -> Result<(), String> {
    let mut vm = Vm::start_waiting(image, Some(OWN_TPM))?;
    vm.confirm_recovery_key()?;
    let seal = vm.run(&format!(
        "NEWPIN=lostpin1 systemd-cryptenroll --unlock-tpm2-device=auto --tpm2-with-pin=yes --wipe-slot=tpm2 --tpm2-device=auto --tpm2-pcrs=4+7 \
         --tpm2-public-key=/run/systemd/tpm2-pcr-public-key.pem --tpm2-public-key-pcrs=11 {PARTITION} >/dev/null 2>&1; echo $?"
    ))?;
    ensure(seal == "0", format!("could not set up the case: {seal}"))?;
    vm.cut_power()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    open_past_the_pin_with_recovery_key(&mut vm)?;
    let key = vm.recovery_key.clone();
    vm.wait_for_screen("setup was interrupted", scaled(SCREEN_LIMIT))?;
    vm.type_text(&format!("{key}\n"))?;
    vm.wait_for_screen("how should this machine start", scaled(SCREEN_LIMIT))?;
    vm.type_text("\n")?;
    wait_disk_step_done(&mut vm)?;
    let record = vm.run(&format!("cat {RECORD}"))?;
    ensure(record == "encrypted-tpm2", record)?;
    vm.reboot()?;
    wait_open(&mut vm)
}

/// A real failure in the last disk step: first boot stops, nothing is recorded, and the screen unit does
/// not start and draw over the message.
fn failed_disk_step_stops_first_boot_visibly(image: &Path) -> Result<(), String> {
    let mut vm = Vm::start_waiting(image, None)?;
    vm.wait_for_screen(NO_TPM_QUESTION, scaled(SCREEN_LIMIT))?;
    sleep(KEYBOARD_READY);
    vm.run("mount --bind /bin/false /usr/bin/systemd-cryptenroll")?;
    vm.type_text("STORE UNENCRYPTED\n")?;
    vm.wait_for_screen("could not finish setting up", scaled(SCREEN_LIMIT))?;
    sleep(scaled(SETTLE));
    vm.wait_for_screen("could not finish setting up", scaled(SETTLE))?;
    let record = vm.run(&format!("test -e {RECORD}; echo $?"))?;
    ensure(record == "1", "a failure recorded a protection state")?;
    let screen = vm.run("systemctl is-active cage-console medbrains-firstboot; true")?;
    ensure(
        !screen.contains("\nactive") && !screen.starts_with("active"),
        screen,
    )
}

/// A power cut while the key is on the screen replaces that key: the old one must stop working.
fn power_cut_replaces_unconfirmed_key(vm: &mut Vm, image: &Path) -> Result<(), String> {
    vm.cut_power()?;
    *vm = Vm::start_waiting(image, Some(OWN_TPM))?;
    let first = vm.read_recovery_key()?;
    vm.cut_power()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    let second = vm.read_recovery_key()?;
    ensure(first != second, "the same key was shown twice")?;
    let tests = format!(
        "printf %s {first} | cryptsetup open --test-passphrase --disable-external-tokens --key-file=- {PARTITION}; echo $?; printf %s {second} | cryptsetup open --test-passphrase --disable-external-tokens --key-file=- {PARTITION}; echo $?"
    );
    let codes = vm.run(&tests)?;
    let codes: Vec<&str> = codes.lines().filter(|l| l.len() == 1).collect();
    ensure(
        codes == ["2", "0"],
        format!("old key should fail and new key should open; exit codes {codes:?}"),
    )
}

/// Prints one result line and says whether it passed.
fn report(name: &str, result: &Result<(), String>, started: Instant) -> bool {
    let line = match result {
        Ok(()) => format!("pass  {name} ({:.1}s)\n", started.elapsed().as_secs_f32()),
        Err(why) => format!("FAIL  {name}: {why}\n"),
    };
    drop(std::io::Write::write_all(
        &mut std::io::stderr(),
        line.as_bytes(),
    ));
    result.is_ok()
}

/// Runs steps in order and stops at the first failure; returns the number of steps failed or not run.
fn run_steps(vm: &mut Vm, image: &Path, steps: &[Step]) -> usize {
    for (done, (name, step)) in steps.iter().enumerate() {
        let started = Instant::now();
        if !report(name, &step(vm, image), started) {
            return steps.len() - done;
        }
    }
    0
}

/// Only the PIN scenarios, each on a new machine.
pub(crate) fn run_pin_only(image: &Path) -> usize {
    let mut failed = 0;
    let started = Instant::now();
    let pin_name = "a PIN is asked at every start, and a wrong one refused";
    failed += usize::from(!report(
        pin_name,
        &pin_is_asked_at_every_start(image),
        started,
    ));
    let started = Instant::now();
    let cut = "a power cut during PIN setup recovers with the saved key";
    failed += usize::from(!report(
        cut,
        &power_cut_during_pin_setup_recovers(image),
        started,
    ));
    failed
}

/// Every scenario on a machine with a TPM, starting from one that is up with its key confirmed.
pub(crate) fn run_sealed_disk(vm: &mut Vm, image: &Path) -> Result<usize, String> {
    if !tpm_usable() {
        drop(std::io::Write::write_all(&mut std::io::stderr(), b"skip  sealed disk scenarios: this kernel has no driver for QEMU's TPM; run with MB_OS_TEST_ARCH=x86-64\n"));
        return Ok(0);
    }
    wait_disk_step_done(vm)?;
    let steps: Vec<Step> = vec![
        (
            "the data disk is LUKS2, sealed to the TPM, with a recovery key",
            sealed_with_recovery_key,
        ),
        (
            "the recovery key is not in the journal",
            recovery_key_not_logged,
        ),
        (
            "a raw copy shows no data, while the plaintext control is found",
            raw_disk_shows_nothing,
        ),
        (
            "a copied disk on another TPM stays locked and says why",
            copy_stays_locked,
        ),
        ("a wrong recovery key is refused", wrong_key_refused),
        (
            "the recovery key opens the copy, with its data",
            recovery_key_opens_copy,
        ),
        (
            "after sealing to the new TPM the copy opens by itself",
            reseal_to_new_tpm,
        ),
        (
            "the original opens with no typing, cold and on a restart",
            normal_restarts_need_no_typing,
        ),
        ("the boot menu and its editor are off", boot_editor_off),
        (
            "a changed boot file stays locked; restored, it opens",
            changed_boot_file_stays_locked,
        ),
        (
            "a stolen machine with an attacker's kernel cannot replay its way in",
            stolen_machine_replay_refused,
        ),
        (
            "KNOWN GAP: an edited system partition still runs with the disk open",
            known_gap_system_partition_edit_opens,
        ),
        (
            "a sealed disk with its TPM gone stays locked and says why",
            missing_tpm_stays_locked,
        ),
        (
            "destroying the key slots means even the recovery key opens nothing",
            destroying_the_key_wipes_the_disk,
        ),
        (
            "a power cut at the key screen replaces the unconfirmed key",
            power_cut_replaces_unconfirmed_key,
        ),
    ];
    let failed = run_steps(vm, image, &steps);
    vm.cut_power()?;
    let started = Instant::now();
    let pin_name = "a PIN is asked at every start, and a wrong one refused";
    let mut failed = failed
        + usize::from(!report(
            pin_name,
            &pin_is_asked_at_every_start(image),
            started,
        ));
    let started = Instant::now();
    let cut = "a power cut during PIN setup recovers with the saved key";
    failed += usize::from(!report(
        cut,
        &power_cut_during_pin_setup_recovers(image),
        started,
    ));
    Ok(failed)
}

/// Turning off from the no-TPM question stores nothing.
fn no_tpm_can_turn_off(image: &Path) -> Result<(), String> {
    let mut vm = Vm::start_waiting(image, None)?;
    vm.wait_for_screen(NO_TPM_QUESTION, scaled(SCREEN_LIMIT))?;
    sleep(KEYBOARD_READY);
    let partition = vm.run(&format!("test -e {PARTITION}; echo $?"))?;
    ensure(
        partition == "1",
        "a data partition exists before anyone chose",
    )?;
    vm.type_text("OFF\n")?;
    vm.wait_for_power_off(scaled(SCREEN_LIMIT))
}

/// Typing the choice stores data unencrypted, records and shows that, and later boots ask nothing.
fn no_tpm_records_the_choice(image: &Path) -> Result<(), String> {
    let mut vm = Vm::start_waiting(image, None)?;
    vm.wait_for_screen(NO_TPM_QUESTION, scaled(SCREEN_LIMIT))?;
    sleep(KEYBOARD_READY);
    vm.type_text("yes\n")?;
    sleep(SETTLE);
    let partition = vm.run(&format!("test -e {PARTITION}; echo $?"))?;
    ensure(partition == "1", "any other answer must store nothing")?;
    vm.type_text("STORE UNENCRYPTED\n")?;
    wait_disk_step_done(&mut vm)?;
    let record = vm.run(&format!("cat {RECORD}"))?;
    ensure(record == "unencrypted-chosen", record)?;
    vm.reboot()?;
    wait_open(&mut vm)?;
    if tpm_usable() {
        tpm_fitted_later(&mut vm)?;
    }
    Ok(())
}

/// The recipe in OS-KEYS.md for a TPM fitted later: no empty key left, and the disk opens by itself.
fn tpm_fitted_later(vm: &mut Vm) -> Result<(), String> {
    vm.shut_down()?;
    let disk = vm.disk();
    vm.boot(&disk, Some(OWN_TPM))?;
    wait_open(vm)?;
    let done = vm.run(&format!(
        "umask 077; systemd-cryptenroll --unlock-key-file=/dev/null --recovery-key {PARTITION} 2>/dev/null | tr -d '[:space:]' > /run/k; \
         systemd-cryptenroll --unlock-key-file=/run/k --tpm2-device=auto --tpm2-pcrs=4+7 --wipe-slot=empty {PARTITION} >/dev/null 2>&1; echo $?; rm -f /run/k"
    ))?;
    ensure(done == "0", format!("the recipe returned {done}"))?;
    let slots = vm.run(&format!("systemd-cryptenroll {PARTITION}"))?;
    ensure(
        slots.contains("tpm2") && slots.contains("recovery") && !slots.contains("password"),
        slots,
    )?;
    vm.reboot()?;
    wait_open(vm)
}

/// Every scenario on a machine with no TPM.
pub(crate) fn run_without_sealed_disk(image: &Path) -> usize {
    let steps: [NewMachineStep; 3] = [
        (
            "a failed disk step stops first boot, and the message stays",
            failed_disk_step_stops_first_boot_visibly,
        ),
        (
            "with no TPM, setup asks and can turn off, storing nothing",
            no_tpm_can_turn_off,
        ),
        (
            "with no TPM, typing the choice records it and later boots open",
            no_tpm_records_the_choice,
        ),
    ];
    let mut failed = 0;
    for (name, step) in steps {
        let started = Instant::now();
        failed += usize::from(!report(name, &step(image), started));
    }
    failed
}
