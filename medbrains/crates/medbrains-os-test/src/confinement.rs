//! `AppArmor` (T1.1): every `MedBrains` service runs under its own profile, in enforce mode, and nothing
//! it did during the suite was refused. Run last, so the suite has exercised every service first. Also
//! the CIS-style hardening report (X16), saved beside the test's other output.

use std::io::Write;
use std::time::Duration;

use serde_json::Value;

use crate::ensure;
use crate::vm::Vm;

/// Process name, and the profile it must run under.
const CONFINED: [(&str, &str); 6] = [
    ("medbrains-server", "medbrains-server"),
    ("medbrains-front", "medbrains-front"),
    ("medbrains-agent", "medbrains-agent"),
    ("medbrains-os-setup", "medbrains-os-setup"),
    ("kanidmd", "kanidmd"),
    ("postgres", "medbrains-postgres"),
];
/// Every `AppArmor` decision this boot, one line per distinct access, without times and process ids.
const DECISIONS: &str = "journalctl -b -o cat --no-pager | grep -E 'apparmor=\"(DENIED|ALLOWED)\"' | sed -E 's/.*(apparmor=)/\\1/; s/ (pid|fsuid|ouid|auid|ses)=[0-9]+//g; s/ comm=\"[^\"]*\"//' | sort -u | head -c 16000";

/// `AppArmor` is the kernel's active LSM and each service runs under its profile, in enforce mode.
pub(crate) fn services_confined(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let lsm = vm.run("cat /sys/kernel/security/lsm")?;
    ensure(
        lsm.split(',').any(|m| m == "apparmor"),
        format!("AppArmor is not active: {lsm}"),
    )?;
    for (process, profile) in CONFINED {
        let label = vm.run(&format!(
            "cat /proc/$(pidof -s {process})/attr/apparmor/current 2>&1"
        ))?;
        let want = format!("{profile} (enforce)");
        ensure(
            label.trim() == want,
            format!("{process} runs as {label}, not {want}"),
        )?;
    }
    Ok(())
}

/// Nothing a service did during the suite was refused, or would have been: the profiles fit the app.
pub(crate) fn nothing_refused(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let seen = vm.run(DECISIONS)?;
    ensure(
        seen.trim().is_empty(),
        format!("AppArmor decisions:\n{seen}"),
    )
}

/// Runs the CIS Debian Level 2 style check on the machine, saves its report, and fails on any FAIL line.
/// The report goes to `MB_OS_TEST_CIS_REPORT`, or `cis-report.txt` in the temporary folder.
pub(crate) fn cis_benchmark(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let report = vm.run_for(
        "/usr/lib/medbrains/cis-check 2>&1",
        crate::vm::scaled(Duration::from_secs(90)),
    )?;
    let path = std::env::var_os("MB_OS_TEST_CIS_REPORT").map_or_else(
        || std::env::temp_dir().join("cis-report.txt"),
        std::path::PathBuf::from,
    );
    std::fs::write(&path, &report).map_err(|e| format!("{}: {e}", path.display()))?;
    let summary = report
        .lines()
        .find(|l| l.starts_with("SUMMARY"))
        .unwrap_or("no summary");
    drop(std::io::stderr().write_all(format!("      {summary} ({})\n", path.display()).as_bytes()));
    let failed: Vec<&str> = report.lines().filter(|l| l.starts_with("FAIL")).collect();
    let why = if failed.is_empty() {
        report.trim().to_owned()
    } else {
        failed.join("\n")
    };
    ensure(failed.is_empty() && summary.contains("fail=0"), why)
}
