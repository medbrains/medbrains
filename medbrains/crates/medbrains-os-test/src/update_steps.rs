//! The update scenarios. Each names the requirement it proves (`OS-UPDATES.md`, "What is proved").

use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::update_power::wait_for;
use crate::updates::{
    Bench, Scenario, ensure, open_mirror, same_var, say, status, url, var_snapshot, wait_status,
    wait_version,
};
use crate::vm::{self, Vm};
use crate::{update_channel, update_power, update_seal, update_sealed, update_verity};

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
                "a sealed disk keeps its data through an update, and opens by itself after going back",
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
            (
                "an older system signed with our keys does not open the disk",
                update_sealed::floor_refuses_older_system,
            ),
            (
                "an added loader entry with a foreign root hash does not open the disk",
                update_sealed::added_entry_is_ignored,
            ),
            // The review's four apply scenarios, on a sealed disk: a good update is the first above.
            (
                "refuses unsigned, tampered, wrong and old bundles",
                refusals,
            ),
            (
                "a power cut while applying and on trial leaves a machine that boots",
                update_power::power_cuts_applying,
            ),
            (
                "a new version that fails its checks rolls back by itself",
                failed_health,
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
            update_power::power_cuts_installing,
        ),
        (
            "a power cut while applying and on trial leaves a machine that boots",
            update_power::power_cuts_applying,
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
        (
            "a seal failure in use is said and waits for the next start",
            update_seal::damage_in_use_waits_for_a_restart,
        ),
        (
            "a seal failure at start is recorded and the machine goes back",
            update_seal::damage_at_start_is_recorded,
        ),
        (
            "a changed boot file stops an install and an apply",
            update_seal::boot_files_are_checked,
        ),
    ]
}

/// Asks for a restart through the same door the screen uses. Sent in the background: the machine may stop
/// before the shell can answer, and a restart then proves the request was taken. The answer is kept in
/// `/run`, for a failure report.
pub(crate) fn ask_restart(vm: &mut Vm, action: &str) -> Result<(), String> {
    vm.run(&format!(
        "(curl -s -m 15 --unix-socket /run/medbrains-console/setup.sock -d '{{\"action\":\"{action}\"}}' http://machine/update/action > /run/ask-{action}.json 2>&1 &)"
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
    wait_version(vm, version, RESTART_LIMIT)
        .map_err(|e| format!("{e}; {}", why_not_started(vm)))?;
    wait_status(vm, &["last", "version"], version, RESTART_LIMIT)?;
    let value = wait_status(vm, &["last", "result"], "good", RESTART_LIMIT)?;
    ensure(
        value["stage"] == "idle",
        format!("stage after good: {value}"),
    )?;
    // The record says good when the health check passes; systemd-bless-boot renames the entry just after,
    // once boot-complete.target is reached. Read straight after, the old name can still be there.
    let blessed = format!(
        "for i in $(seq 30); do ls /boot/EFI/Linux | grep -q '{version}+' || break; sleep 1; done; ls /boot/EFI/Linux"
    );
    let entries = vm.run_for(&blessed, Duration::from_secs(45))?;
    ensure(
        !entries.contains(&format!("{version}+")),
        format!("the boot entry was not marked good: {entries}"),
    )?;
    vm.wait_for_server()?;
    open_mirror(vm, bench)?;
    Ok(started.elapsed())
}

/// What the running machine says about an update that should have started: its record, its boot
/// entries and the last action's log, for a failure report.
fn why_not_started(vm: &mut Vm) -> String {
    let asks = [
        "cat /run/ask-*.json 2>&1",
        "medbrains-os-update status | head -c 400",
        "ls -la /boot/EFI/Linux /boot/EFI/MedBrains 2>&1 | tr '\\n' '|'",
        "systemctl list-jobs --no-pager --no-legend | head -5",
        "systemctl status --no-pager -n 6 'medbrains-os-update@apply.service' 2>&1 | tail -8",
    ];
    asks.iter()
        .map(|ask| vm.run(ask).unwrap_or_else(|e| format!("(no answer: {e})")))
        .collect::<Vec<_>>()
        .join(" // ")
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

/// Where a node's users reach the main machine: the tunnel ends at the loopback front, so to the main
/// machine they are requests on 127.0.0.1:8443, exactly as below.
const FRONT: &str = "https://127.0.0.1:8443";
/// How long nobody must use the app before the window applies, set short for the test.
const TEST_IDLE_MINUTES: u64 = 1;

/// Signs in as the first administrator through the loopback front, as a node's user arrives through the
/// tunnel, and returns the session token.
fn sign_in_over_loopback(vm: &mut Vm, bench: &Bench) -> Result<String, String> {
    let body = format!(
        r#"{{"username":"{}","password":"{}"}}"#,
        crate::setup::ADMIN,
        bench.password
    );
    let answer = vm.run(&format!(
        "curl -sk -m 20 -H 'Content-Type: application/json' -H 'X-MedBrains-Client: mobile-staff' -d '{body}' {FRONT}/api/auth/login"
    ))?;
    let token = answer
        .split_once("\"token\":\"")
        .and_then(|(_, rest)| rest.split_once('"'))
        .map(|(token, _)| token.to_owned());
    token.ok_or_else(|| format!("could not sign in over the loopback front: {answer}"))
}

/// One request as that person; `background` marks it as an idle page's polling.
fn request_as(vm: &mut Vm, token: &str, background: bool) -> Result<(), String> {
    let mark = if background {
        "-H 'X-MedBrains-Background: 1'"
    } else {
        ""
    };
    let code = vm.run(&format!(
        "curl -sk -m 20 -o /dev/null -w '%{{http_code}}' {mark} -H 'Authorization: Bearer {token}' {FRONT}/api/auth/me"
    ))?;
    ensure(
        code == "200",
        format!("the request as a person answered {code}"),
    )
}

/// Requirement 5: a security fix can't silently restart a machine in use. It waits through a tick with no
/// window, a tick outside the window, and a tick inside it while a person, arriving over loopback as a
/// node's users do, is using the app. Once nobody has for the idle time, with the screen on and an idle
/// page still polling, it applies.
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
        "echo {now_start}-{now_end} > /var/lib/medbrains-settings/update-window; echo {TEST_IDLE_MINUTES} > /var/lib/medbrains-settings/update-idle-minutes"
    ))?;
    wait_for(vm, "chronyc -c tracking | grep -q Normal", RESTART_LIMIT)?;
    let token = sign_in_over_loopback(vm, bench)?;
    request_as(vm, &token, false)?;
    let noted = vm.run("cat /run/medbrains-server/last-person-request")?;
    ensure(
        noted.parse::<u64>().is_ok_and(|seconds| seconds > 0),
        format!("the server did not note the person's request: {noted}"),
    )?;
    vm.run("medbrains-os-update tick")?;
    sleep(Duration::from_secs(10));
    ensure(vm.run(boot_id)? == id, "a tick restarted a machine in use")?;
    let value = status(vm)?;
    ensure(value["stage"] == "waiting", format!("{value}"))?;
    // Nobody for the idle time; an idle page keeps polling, marked as background, and must not count.
    sleep(Duration::from_secs(TEST_IDLE_MINUTES * 60 + 5));
    request_as(vm, &token, true)?;
    let screen = vm.run("systemctl is-active cage-console.service")?;
    ensure(
        screen == "active",
        format!("the screen is {screen}, not on"),
    )?;
    vm.run("(nohup medbrains-os-update tick > /dev/null 2>&1 &)")?;
    wait_version(vm, NEXT.1, RESTART_LIMIT).map_err(|e| format!("{e}; {}", why_not_started(vm)))?;
    wait_status(vm, &["last", "result"], "good", RESTART_LIMIT)?;
    Ok(())
}
