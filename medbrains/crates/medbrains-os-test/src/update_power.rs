//! Power cuts during an update (`OS-UPDATES.md`, requirement 3): at every write of an install, and while
//! applying and on each trial start. The running system must never be at stake.

use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::update_steps::{INSTALL_LIMIT, NEXT, RESTART_LIMIT, apply_and_prove, install_ok};
use crate::updates::{
    Bench, ensure, open_mirror, own_tpm, running_version, same_var, say, status, url, var_snapshot,
    wait_status,
};
use crate::vm::{self, Vm};

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
pub(crate) fn wait_for(vm: &mut Vm, test: &str, limit: Duration) -> Result<(), String> {
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
pub(crate) fn power_cuts_installing(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
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
pub(crate) fn power_cuts_applying(vm: &mut Vm, bench: &Bench) -> Result<(), String> {
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
