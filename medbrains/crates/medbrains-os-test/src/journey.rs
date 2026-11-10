//! The app end to end on the image under test: sign in through the page and open Patients, in a real
//! browser on this computer (`os/tests/patients-journey.mjs`). Opt in with `MB_OS_TEST_BROWSER=1`: it
//! needs Node and the web app's Playwright installed here.

use std::process::Command;
use std::sync::OnceLock;

use serde_json::Value;

use crate::ensure;
use crate::vm::Vm;

/// The administrator setup made, kept for this run only: the machine is thrown away after it.
pub(crate) static ADMIN: OnceLock<(String, String)> = OnceLock::new();
const SCRIPT: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../os/tests/patients-journey.mjs"
);

/// Signs in as the setup administrator and opens Patients; skipped unless asked for.
pub(crate) fn sign_in_and_open_patients(vm: &mut Vm, _: &Value) -> Result<(), String> {
    if std::env::var("MB_OS_TEST_BROWSER").as_deref() != Ok("1") {
        return Ok(());
    }
    let (user, password) = ADMIN.get().ok_or("setup made no administrator")?;
    let url = format!("https://127.0.0.1:{}", vm.port("web")?);
    let done = Command::new("node")
        .args([SCRIPT, &url, user, password])
        .output()
        .map_err(|e| format!("node: {e}"))?;
    let said = String::from_utf8_lossy(&done.stdout);
    ensure(
        done.status.success(),
        format!("{said}{}", String::from_utf8_lossy(&done.stderr)),
    )
}
