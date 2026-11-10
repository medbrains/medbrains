//! The update scenarios. Each names the requirement it proves (`OS-UPDATES.md`, "What is proved").

use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::updates::{
    Bench, Scenario, ensure, open_mirror, own_tpm, running_version, same_var, say, status, url,
    var_snapshot, wait_status, wait_version,
};
use crate::vm::{self, Vm};
use crate::{update_channel, update_sealed, update_verity};

/// Bundle folders, as `make-update-bundles.py` names them. `NEXT` is a real second image build.
pub(crate) const NEXT: (&str, &str) = ("next", "1.0.2");
pub(crate) const AFTER: (&str, &str) = ("after", "1.0.3");
pub(crate) const BAD_SERVER: (&str, &str) = ("bad-server", "1.0.4");
const BAD_INIT: (&str, &str) = ("bad-init", "1.0.5");
pub(crate) const INSTALL_LIMIT: Duration = Duration::from_secs(600);
pub(crate) const RESTART_LIMIT: Duration = Duration::from_secs(300);
/// Long enough for a kernel, an initrd and the machine's own watchdogs to fail three times.
pub(crate) const ROLLBACK_LIMIT: Duration = Duration::from_secs(1500);
const COMMAND_LIMIT: Duration = Duration::from_secs(900);
/// The other slot's system partition: of the running one's type, and not the one under `/dev/mapper/root`.
pub(crate) const SLOT: &str = "$(a=$(veritysetup status root | awk '/data device:/ {print $3}'); t=$(lsblk -dno PARTTYPE $a); lsblk -nrpo PATH,PARTTYPE /dev/vda | awk -v a=$a -v t=$t '$2 == t && $1 != a {print $1}')";
/// A slot, the boot partition and the record: changing any is writing.
pub(crate) const FINGERPRINT: &str = "lsblk -nro PARTLABEL /dev/vda; ls -1 /boot/EFI/Linux; ls -1 /boot/EFI/MedBrains 2>/dev/null; head -c 16M SLOT | sha256sum; ls /var/lib/medbrains/update/staging 2>/dev/null";

/// Every scenario, in the order a reader would want them.
pub(crate) fn scenarios() -> Vec<Scenario> {
    if vm::tpm_usable() {
        return vec![
            (
                "a sealed disk opens by itself after an update and after going back",
                update_sealed::sealed_update,
            ),
            (
                "a boot file signed by another key is refused before it can lock the disk",
                update_sealed::sealed_refusal,
            ),
            (
                "a seal that does fail rolls back with nobody typing",
                update_sealed::seal_prompt_rolls_back,
            ),
        ];
    }
    vec![
        (
            "refuses unsigned, tampered, wrong and old bundles",
            refusals,
        ),
        (
            "updates online, keeps /var, goes back, updates twice",
            update_cycle,
        ),
        ("installs from a USB stick", usb_install),
        (
            "a new version that fails its checks rolls back by itself",
            failed_health,
        ),
        (
            "a version that rolled back is not installed again by the timer",
            update_channel::not_retried,
        ),
        (
            "a mix of two releases is refused",
            update_channel::mixed_refused,
        ),
        (
            "a machine that missed a release catches up in order",
            update_channel::catches_up_in_order,
        ),
        (
            "a new version that cannot even start rolls back by itself",
            failed_start,
        ),
        (
            "a system its boot file's seal does not match is never named",
            update_verity::unsealed_never_named,
        ),
        (
            "a slot changed after it was installed does not start, and rolls back",
            update_verity::changed_slot_rolls_back,
        ),
        (
            "a power cut during install leaves a machine that boots",
            power_cuts_installing,
        ),
        (
            "a power cut while applying and on trial leaves a machine that boots",
            power_cuts_applying,
        ),
        (
            "a new version proves good with the network cable out",
            no_network_on_trial,
        ),
        ("too little disk space is refused", low_space),
        (
            "a security fix waits for a person or a quiet window",
            waits_for_quiet,
        ),
    ]
}

/// Asks for a restart through the same door the screen uses. Sent in the background: the machine may stop
/// before the shell can answer, and a restart then proves the request was taken.
pub(crate) fn ask_restart(vm: &mut Vm, action: &str) -> Result<(), String> {
    vm.run(&format!(
        "(curl -s -m 15 --unix-socket /run/medbrains-console/setup.sock -d '{{\"action\":\"{action}\"}}' http://machine/update/action > /dev/null 2>&1 &)"
    ))
    .map(|_| ())
}

/// Asks through the same door the screen uses.
pub(crate) fn ask(vm: &mut Vm, action: &str) -> Result<(), String> {
    let answer = vm.run(&format!(
        "curl -s -m 15 --unix-socket /run/medbrains-console/setup.sock -d '{{\"action\":\"{action}\"}}' http://machine/update/action"
    ))?;
    ensure(
        answer.contains("\"ok\":true"),
        format!("{action} answered {answer}"),
    )
}

/// Runs an install by hand and returns its words and exit status.
pub(crate) fn install_from(
    vm: &mut Vm,
    bench: &Bench,
    name: &str,
    retry: bool,
) -> Result<(String, i32), String> {
    let flag = if retry { "--retry " } else { "" };
    let text = vm.run_for(
        &format!(
            "medbrains-os-update install {flag}--from {} 2>&1; echo EXIT=$?",
            url(bench, name)
        ),
        COMMAND_LIMIT,
    )?;
    let code = text
        .rsplit("EXIT=")
        .next()
        .and_then(|n| n.trim().parse().ok())
        .ok_or_else(|| format!("no exit status: {text}"))?;
    Ok((text, code))
}

/// Installs a bundle that must succeed, and returns how long it took.
pub(crate) fn install_ok(
    vm: &mut Vm,
    bench: &Bench,
    name: &str,
    retry: bool,
) -> Result<Duration, String> {
    let started = Instant::now();
    let (text, code) = install_from(vm, bench, name, retry)?;
    ensure(code == 0, format!("{name}: {text}"))?;
    Ok(started.elapsed())
}

/// Applies a waiting update through the screen's door and waits until the new version has proved good.
pub(crate) fn apply_and_prove(
    vm: &mut Vm,
    bench: &Bench,
    version: &str,
) -> Result<Duration, String> {
    let started = Instant::now();
    ask_restart(vm, "apply")?;
    wait_version(vm, version, RESTART_LIMIT)?;
    wait_status(vm, &["last", "version"], version, RESTART_LIMIT)?;
    let value = wait_status(vm, &["last", "result"], "good", RESTART_LIMIT)?;
    ensure(
        value["stage"] == "idle",
        format!("stage after good: {value}"),
    )?;
    let entries = vm.run("ls /boot/EFI/Linux")?;
    ensure(
        !entries.contains(&format!("{version}+")),
        format!("the boot entry was not marked good: {entries}"),
    )?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    Ok(started.elapsed())
}

/// Requirement 2: nothing bad is written. Each row is refused with its reason, and the slot, the boot
/// partition and the staging folder are exactly as they were.
fn refusals(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let fingerprint = FINGERPRINT.replace("SLOT", SLOT);
    let before = vm.run(&fingerprint)?;
    for (name, expected) in [
        ("unsigned", "no signature"),
        ("bad-key", "not signed by a key"),
        ("tampered-manifest", "not signed by a key"),
        ("tampered-root", "changed after it was signed"),
        ("tampered-boot", "changed after it was signed"),
        ("tampered-verity", "changed after it was signed"),
        ("wrong-arch", "machines; this one is"),
        ("older", "older than"),
        ("too-big", "does not fit"),
        ("expired", "signature has run out"),
    ] {
        let (text, code) = install_from(vm, bench, name, false)?;
        ensure(
            code == 2 && text.contains(expected),
            format!("{name}: {code} {text}"),
        )?;
        let after = vm.run(&fingerprint)?;
        ensure(
            after == before,
            format!("{name} wrote something: {before} / {after}"),
        )?;
        say(&format!("      refused {name}"));
    }
    let (text, code) = install_from(vm, bench, "same", false)?;
    ensure(
        code == 0 && text.contains("already runs"),
        format!("same: {text}"),
    )?;
    let value = status(vm)?;
    ensure(value["stage"] == "idle", format!("stage: {value}"))
}

/// Requirements 1, 3 and 2 together: an update online, a restart that doesn't apply it, /var byte for byte
/// across the update and back, a person's rollback below the floor, a second update, and anti-rollback.
fn update_cycle(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let first = bench.first.clone();
    let before = var_snapshot(vm)?;
    let loader = vm.run("sha256sum /boot/EFI/BOOT/*")?;
    vm.run(&format!(
        "echo {} > /var/lib/medbrains-settings/update-url",
        url(bench, "channel")
    ))?;
    let started = Instant::now();
    ask(vm, "install")?;
    wait_status(vm, &["stage"], "waiting", INSTALL_LIMIT)?;
    say(&format!(
        "      download and install, screen's door: {:.0}s",
        started.elapsed().as_secs_f32()
    ));
    vm.run("rm /var/lib/medbrains-settings/update-url")?;
    vm.reboot()?;
    let value = wait_status(vm, &["stage"], "waiting", RESTART_LIMIT)?;
    ensure(
        value["current"] == first.as_str(),
        format!("a restart applied it: {value}"),
    )?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    let took = apply_and_prove(vm, bench, NEXT.1)?;
    say(&format!(
        "      apply to proved good: {:.0}s",
        took.as_secs_f32()
    ));
    same_var(&before, &var_snapshot(vm)?)?;
    let after_loader = vm.run("sha256sum /boot/EFI/BOOT/*")?;
    ensure(loader == after_loader, "the boot loader changed")?;
    ask_restart(vm, "go-back")?;
    wait_version(vm, &first, RESTART_LIMIT)?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    same_var(&before, &var_snapshot(vm)?)?;
    let (text, code) = install_from(vm, bench, NEXT.0, false)?;
    ensure(
        code == 2 && text.contains("failed on this machine"),
        format!("no retry: {text}"),
    )?;
    install_ok(vm, bench, NEXT.0, true)?;
    apply_and_prove(vm, bench, NEXT.1)?;
    install_ok(vm, bench, AFTER.0, false)?;
    apply_and_prove(vm, bench, AFTER.1)?;
    same_var(&before, &var_snapshot(vm)?)?;
    let value = status(vm)?;
    ensure(value["previous"] == NEXT.1, format!("previous: {value}"))?;
    let (text, code) = install_from(vm, bench, NEXT.0, false)?;
    ensure(
        code == 2 && text.contains("older than"),
        format!("old signed bundle: {text}"),
    )?;
    // The third update overwrote the first version's slot and raised the floor to 1.0.3. A person may
    // still go back to 1.0.2, while a signed version below the floor stays refused.
    ask_restart(vm, "go-back")?;
    wait_version(vm, NEXT.1, RESTART_LIMIT)?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    same_var(&before, &var_snapshot(vm)?)?;
    let (text, code) = install_from(vm, bench, "below-floor", false)?;
    ensure(
        code == 2 && text.contains("known problems"),
        format!("below the floor: {text}"),
    )
}

/// Requirement 1: the same checks from local media. A stick arrives by hot plug, as a real one does.
fn usb_install(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let before = var_snapshot(vm)?;
    let stick = bench.bundles.join("usb.img");
    vm.monitor(&format!(
        "drive_add 0 if=none,id=stick,format=raw,readonly=on,file={}",
        stick.display()
    ))?;
    vm.monitor("device_add usb-storage,drive=stick,id=stick0,removable=on")?;
    sleep(Duration::from_secs(5));
    let seen = vm.run("lsblk -rno PATH,HOTPLUG,RM,FSTYPE")?;
    say(&format!("      sees: {}", seen.replace('\n', "; ")));
    ask(vm, "usb")?;
    wait_status(vm, &["stage"], "waiting", INSTALL_LIMIT)?;
    let mounted = vm.run("findmnt -rno TARGET | grep -c medbrains-update; true")?;
    ensure(mounted == "0", "the stick stayed mounted")?;
    apply_and_prove(vm, bench, NEXT.1)?;
    same_var(&before, &var_snapshot(vm)?)
}

/// Requirement 3: a version whose server is missing fails its checks, goes back by itself, says why on the
/// screen, leaves /var as it was and is not tried again by itself.
fn failed_health(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let before = var_snapshot(vm)?;
    install_ok(vm, bench, BAD_SERVER.0, false)?;
    ask_restart(vm, "apply")?;
    let took = wait_version(vm, BAD_SERVER.1, RESTART_LIMIT)?;
    say(&format!(
        "      new version up after {:.0}s",
        took.as_secs_f32()
    ));
    let took = wait_version(vm, &bench.first, RESTART_LIMIT + RESTART_LIMIT)?;
    say(&format!(
        "      back by itself after {:.0}s more",
        took.as_secs_f32()
    ));
    let value = wait_status(vm, &["last", "result"], "rolled_back", RESTART_LIMIT)?;
    let words = value["last"]["words"].as_str().unwrap_or("");
    ensure(
        words.contains("medbrains-server") || words.contains("server"),
        format!("no reason: {words}"),
    )?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    same_var(&before, &var_snapshot(vm)?)?;
    let (text, code) = install_from(vm, bench, BAD_SERVER.0, false)?;
    ensure(code == 2 && text.contains("failed on this machine"), text)
}

/// Requirement 3: a version with no working system on it never reaches the health check at all.
fn failed_start(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let before = var_snapshot(vm)?;
    install_ok(vm, bench, BAD_INIT.0, false)?;
    ask_restart(vm, "apply")?;
    let started = Instant::now();
    sleep(Duration::from_secs(20));
    let took = wait_version(vm, &bench.first, ROLLBACK_LIMIT)?;
    say(&format!(
        "      back by itself after {:.0}s",
        started.elapsed().max(took).as_secs_f32()
    ));
    wait_status(vm, &["last", "result"], "rolled_back", RESTART_LIMIT)?;
    vm.wait_for_server()?;
    same_var(&before, &var_snapshot(vm)?)
}

/// Puts a stand-in for `program` first on the path of commands started from this shell: it stops at its
/// `nth` run, before or after doing the real work, and says so. Nothing in the product changes.
fn hook(vm: &mut Vm, program: &str, real: &str, nth: u32, after: bool) -> Result<(), String> {
    let (before_run, after_run) = if after { ("", "x") } else { ("x", "") };
    let script = format!(
        "#!/bin/sh\nn=$(cat /run/hook/{program}.n 2>/dev/null || echo 0); n=$((n+1)); echo $n > /run/hook/{program}.n\n\
         if [ \"$n\" = {nth} ] && [ -n \"{before_run}\" ]; then touch /run/hook/hit; sleep 100000; fi\n\
         {real} \"$@\"; code=$?\n\
         if [ \"$n\" = {nth} ] && [ -n \"{after_run}\" ]; then touch /run/hook/hit; sleep 100000; fi\nexit $code\n"
    );
    vm.run(&format!(
        "mkdir -p /run/hook; rm -f /run/hook/*; cat > /run/hook/{program} <<'HOOK'\n{script}HOOK\nchmod +x /run/hook/{program}"
    ))?;
    Ok(())
}

/// Waits for a shell test to pass.
fn wait_for(vm: &mut Vm, test: &str, limit: Duration) -> Result<(), String> {
    let deadline = Instant::now() + vm::scaled(limit);
    while Instant::now() < deadline {
        if vm.run_for(&format!("{test}; echo $?"), Duration::from_secs(10))? == "0" {
            return Ok(());
        }
        sleep(Duration::from_millis(500));
    }
    Err(format!("never true: {test}"))
}

/// Starts an install in the background, seeing any stand-ins. In a subshell: the shell runner appends
/// `; echo`, and `cmd &;` does not parse.
fn start_install(vm: &mut Vm, bench: &Bench, name: &str) -> Result<(), String> {
    vm.run(&format!(
        "(PATH=/run/hook:$PATH nohup medbrains-os-update install --retry --from {} > /run/install.out 2>&1 &)",
        url(bench, name)
    ))
    .map(|_| ())
}

/// Cuts the power, turns it on again and checks the machine: the old version, healthy, /var as it was.
fn cut_and_check(vm: &mut Vm, bench: &Bench, before: &str, step: &str) -> Result<(), String> {
    vm.cut_power()?;
    let disk = vm.scratch_path("scenario.qcow2");
    vm.boot(&disk, own_tpm())?;
    let version = running_version(vm)?;
    ensure(version == bench.first, format!("{step}: booted {version}"))?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    same_var(before, &var_snapshot(vm)?).map_err(|e| format!("{step}: {e}"))?;
    say(&format!(
        "      cut {step}: boots {version}, healthy, /var unchanged"
    ));
    Ok(())
}

/// Requirement 3: a power cut at each step of an install. The running system is never at stake.
fn power_cuts_installing(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let before = var_snapshot(vm)?;
    start_install(vm, bench, NEXT.0)?;
    wait_for(
        vm,
        "test -s /var/lib/medbrains/update/staging/root.img.zst",
        INSTALL_LIMIT,
    )?;
    cut_and_check(vm, bench, &before, "while downloading")?;
    let value = status(vm)?;
    ensure(value["last"]["result"] == "interrupted", format!("{value}"))?;
    wait_for(
        vm,
        "test ! -e /var/lib/medbrains/update/staging",
        RESTART_LIMIT,
    )?;
    // sfdisk runs four times to empty a slot (name, UUID, tree UUID, tree name) and four to name it
    // (tree UUID, tree name, UUID, name): `steps.rs`.
    let stages: [(&str, &str, u32, bool); 5] = [
        ("before the slot is emptied", "/usr/sbin/sfdisk", 1, false),
        ("half emptied", "/usr/sbin/sfdisk", 3, false),
        (
            "after the image and tree are written and verified, before they are named",
            "/usr/sbin/sfdisk",
            5,
            false,
        ),
        (
            "with the tree named, the system not",
            "/usr/sbin/sfdisk",
            7,
            false,
        ),
        (
            "after it is named, before the boot file",
            "/usr/sbin/sfdisk",
            8,
            true,
        ),
    ];
    for (step, real, nth, after) in stages {
        hook(vm, "sfdisk", real, nth, after)?;
        start_install(vm, bench, NEXT.0)?;
        wait_for(vm, "test -e /run/hook/hit", INSTALL_LIMIT)?;
        cut_and_check(vm, bench, &before, step)?;
    }
    start_install(vm, bench, NEXT.0)?;
    wait_for(
        vm,
        "grep -q '\"stage\": \"writing\"' /var/lib/medbrains/update/state.json",
        INSTALL_LIMIT,
    )?;
    sleep(Duration::from_secs(3));
    cut_and_check(vm, bench, &before, "while writing the slot")?;
    install_ok(vm, bench, NEXT.0, true)?;
    cut_and_check(vm, bench, &before, "with the update installed and waiting")?;
    let value = status(vm)?;
    ensure(value["stage"] == "waiting", format!("{value}"))?;
    apply_and_prove(vm, bench, NEXT.1)?;
    same_var(&before, &var_snapshot(vm)?)
}

/// Requirement 3: a power cut after applying, then three on the new version's first starts: the loader
/// runs out of tries and the old version comes back.
fn power_cuts_applying(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let before = var_snapshot(vm)?;
    let disk = vm.scratch_path("scenario.qcow2");
    install_ok(vm, bench, NEXT.0, false)?;
    hook(vm, "systemctl", "/usr/bin/systemctl", 1, false)?;
    vm.run("(PATH=/run/hook:$PATH nohup medbrains-os-update apply > /run/apply.out 2>&1 &)")?;
    wait_for(vm, "test -e /run/hook/hit", RESTART_LIMIT)?;
    for attempt in 1..=3 {
        vm.cut_power()?;
        vm.boot(&disk, own_tpm())?;
        let version = running_version(vm)?;
        ensure(
            version == NEXT.1,
            format!("start {attempt}: booted {version}"),
        )?;
        say(&format!("      cut on trial start {attempt}"));
    }
    vm.cut_power()?;
    vm.boot(&disk, own_tpm())?;
    let version = running_version(vm)?;
    ensure(
        version == bench.first,
        format!("after three cuts: booted {version}"),
    )?;
    wait_status(vm, &["last", "result"], "rolled_back", RESTART_LIMIT)?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    same_var(&before, &var_snapshot(vm)?)?;
    install_ok(vm, bench, NEXT.0, true)?;
    apply_and_prove(vm, bench, NEXT.1)?;
    vm.cut_power()?;
    vm.boot(&disk, own_tpm())?;
    let version = running_version(vm)?;
    ensure(
        version == NEXT.1,
        format!("a cut after proving good: booted {version}"),
    )?;
    vm.wait_for_server()?;
    same_var(&before, &var_snapshot(vm)?)
}

/// Requirement 3: a hospital's network being down is no reason to throw away a good update. A machine that
/// needs the network to pass would roll back on every night the switch is off.
fn no_network_on_trial(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    install_ok(vm, bench, NEXT.0, false)?;
    vm.monitor("set_link net0 off")?;
    ask_restart(vm, "apply")?;
    wait_version(vm, NEXT.1, RESTART_LIMIT)?;
    let value = wait_status(vm, &["last", "result"], "good", RESTART_LIMIT)?;
    ensure(value["last"]["version"] == NEXT.1, format!("{value}"))
}

/// Requirement 2 and the disk-space test: refused with the reason, and nothing written.
fn low_space(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    let fingerprint = FINGERPRINT.replace("SLOT", SLOT);
    let before = vm.run(&fingerprint)?;
    let free: u64 = vm
        .run("df -B1 --output=avail /var | tail -1 | tr -d ' '")?
        .parse()
        .map_err(|e| format!("free space: {e}"))?;
    vm.run(&format!(
        "fallocate -l {} /var/lib/medbrains/os-test-filler",
        free - 512 * 1024 * 1024
    ))?;
    let (text, code) = install_from(vm, bench, NEXT.0, false)?;
    ensure(
        code == 2 && text.contains("data disk"),
        format!("{code} {text}"),
    )?;
    vm.run("rm /var/lib/medbrains/os-test-filler")?;
    ensure(
        vm.run(&fingerprint)? == before,
        "a refused update wrote to the disk",
    )?;
    let free: u64 = vm
        .run("ls /boot >/dev/null; df -B1 --output=avail /boot | tail -1 | tr -d ' '")?
        .parse()
        .map_err(|e| format!("free space: {e}"))?;
    vm.run(&format!(
        "fallocate -l {} /boot/os-test-filler || head -c {} /dev/zero > /boot/os-test-filler",
        free - 4096,
        free - 4096
    ))?;
    let (text, code) = install_from(vm, bench, NEXT.0, false)?;
    ensure(
        code == 2 && text.contains("boot partition"),
        format!("{code} {text}"),
    )?;
    vm.run("rm /boot/os-test-filler")?;
    ensure(
        vm.run(&fingerprint)? == before,
        "a refused update wrote to the boot partition",
    )
}

/// Requirement 5: a security fix can't silently restart a machine in use. It waits through a tick with no
/// window, a tick outside the window, and a tick inside it with someone connected, then applies.
fn waits_for_quiet(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
    install_ok(vm, bench, "next-security", false)?;
    let value = status(vm)?;
    ensure(
        value["security"] == true,
        format!("not marked security: {value}"),
    )?;
    let headline = value["headline"].as_str().unwrap_or("");
    ensure(
        headline.contains("security fix"),
        format!("headline: {headline}"),
    )?;
    let boot_id = "cat /proc/sys/kernel/random/boot_id";
    let id = vm.run(boot_id)?;
    vm.run("medbrains-os-update tick")?;
    let far_away = vm.run("date -d '+6 hours' +%H:%M")?;
    let further = vm.run("date -d '+7 hours' +%H:%M")?;
    vm.run(&format!(
        "echo {far_away}-{further} > /var/lib/medbrains-settings/update-window"
    ))?;
    vm.run("medbrains-os-update tick")?;
    let now_start = vm.run("date -d '-1 minute' +%H:%M")?;
    let now_end = vm.run("date -d '+20 minutes' +%H:%M")?;
    vm.run(&format!(
        "echo {now_start}-{now_end} > /var/lib/medbrains-settings/update-window"
    ))?;
    wait_for(vm, "chronyc -c tracking | grep -q Normal", RESTART_LIMIT)?;
    vm.run("exec 9<>/dev/tcp/127.0.0.1/3000")?;
    vm.run("medbrains-os-update tick")?;
    sleep(Duration::from_secs(10));
    ensure(vm.run(boot_id)? == id, "a tick restarted a machine in use")?;
    let value = status(vm)?;
    ensure(value["stage"] == "waiting", format!("{value}"))?;
    vm.run("exec 9<&-; sleep 2")?;
    vm.run("(nohup medbrains-os-update tick > /dev/null 2>&1 &)")?;
    wait_version(vm, NEXT.1, RESTART_LIMIT)?;
    wait_status(vm, &["last", "result"], "good", RESTART_LIMIT)?;
    Ok(())
}
