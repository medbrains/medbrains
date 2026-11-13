//! Makes a booted machine a main machine, as the screen's setup does, including the first administrator's
//! authenticator enrolment (#5316). The code is worked out inside the machine, from its own clock, with the
//! openssl it already has, so this test needs no TOTP library.

use std::time::{Duration, Instant};

use serde_json::Value;

use crate::vm::{self, Vm};
use crate::{ensure, journey};

const SETUP_LIMIT: Duration = Duration::from_secs(150);
const SETUP_SOCKET: &str = "/run/medbrains-console/setup.sock";
const USERNAME: &str = "os_test_admin";
/// Kanidm's default authenticator: HMAC-SHA256 over the 30-second step, six digits. `$1` is the base32 secret.
const TOTP: &str = r#"k=$(printf %s "$1" | base32 -d | od -An -tx1 -v | tr -d ' \n'); c=$(( $(date +%s) / 30 )); mapfile -t b < <(printf "$(printf %016x $c | sed 's/../\\x&/g')" | openssl dgst -sha256 -mac HMAC -macopt hexkey:$k -binary | od -An -tu1 -v | tr -s ' ' '\n' | grep .); o=$(( b[31] & 15 )); printf %06d $(( ((b[o] & 127) << 24 | b[o+1] << 16 | b[o+2] << 8 | b[o+3]) % 1000000 ))"#;

/// One call to the setup service over its socket, as the screen makes it.
fn setup_call(vm: &mut Vm, path: &str, body: &str) -> Result<String, String> {
    vm.run_for(
        // The shell can answer before the setup service has opened its socket.
        &format!(
            "for i in $(seq 60); do test -S {SETUP_SOCKET} && break; sleep 1; done; curl -s -m 80 --unix-socket {SETUP_SOCKET} -d '{body}' http://machine{path}"
        ),
        SETUP_LIMIT,
    )
}

/// The authenticator secret setup shows, unspaced and padded for `base32 -d`; None if this disk has no
/// identity provider, when setup asks for no code.
fn secret_of(answer: &str) -> Result<Option<String>, String> {
    let parsed: Value = serde_json::from_str(answer)
        .map_err(|_| format!("setup's first step answered {answer}"))?;
    let Some(secret) = parsed.pointer("/totp/secret").and_then(Value::as_str) else {
        return ensure(
            parsed.get("totp").is_some_and(Value::is_null),
            format!("no secret: {answer}"),
        )
        .map(|()| None);
    };
    let mut text: String = secret.chars().filter(|c| !c.is_whitespace()).collect();
    while !text.len().is_multiple_of(8) {
        text.push('=');
    }
    Ok(Some(text))
}

/// Makes this machine a main machine: nothing runs before that. The password is made fresh, so none is
/// written down, and the machine is thrown away. The username is not `admin`, which setup refuses because
/// Kanidm keeps it, and the password is a phrase, because Kanidm's strength check is what setup applies.
pub(crate) fn set_up_main(vm: &mut Vm) -> Result<(), String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let password = format!("Night porter {stamp} keeps blue lanterns");
    drop(journey::ADMIN.set((USERNAME.to_owned(), password.clone())));
    let deadline = Instant::now() + vm::scaled(SETUP_LIMIT);
    while vm.run(&format!("test -S {SETUP_SOCKET}; echo $?"))? != "0" {
        ensure(Instant::now() < deadline, "the setup service never started")?;
        std::thread::sleep(Duration::from_secs(2));
    }
    let fields =
        format!(r#""hospital":"Test Hospital","username":"{USERNAME}","password":"{password}""#);
    let begun = setup_call(vm, "/hospital/admin", &format!("{{{fields}}}"))?;
    let code = match secret_of(&begun)? {
        Some(secret) => vm.run(&format!(
            "bash -c '{}' _ '{secret}'",
            TOTP.replace('\'', r"'\''")
        ))?,
        None => String::new(),
    };
    let answer = setup_call(vm, "/hospital", &format!(r#"{{{fields},"code":"{code}"}}"#))?;
    ensure(
        answer.contains("\"ok\":true"),
        format!("setup answered {answer}"),
    )
}

/// What a machine that did not come up says about itself: its failed units and the last lines of each.
pub(crate) fn why_not_running(vm: &mut Vm) -> String {
    vm.run("systemctl --failed --no-legend --plain; systemctl list-jobs --no-legend | head -8; for u in $(systemctl --failed --no-legend --plain | awk '{print $1}' | head -4); do journalctl -b -u $u -n 12 --no-pager -o cat; done")
        .unwrap_or_else(|e| format!("could not ask the machine: {e}"))
}

#[cfg(test)]
mod tests {
    use super::secret_of;

    /// The secret is read as setup sends it, and a disk with no identity provider needs no code.
    #[test]
    fn secret_is_unspaced_and_padded_and_absent_when_setup_asks_none() {
        let shown = r#"{"totp":{"secret":"JBSW Y3DP EHPK 3PXP","uri":"otpauth://x"}}"#;
        assert_eq!(secret_of(shown), Ok(Some("JBSWY3DPEHPK3PXP".to_owned())));
        let odd = r#"{"totp":{"secret":"MFRG G"}}"#;
        assert_eq!(secret_of(odd), Ok(Some("MFRGG===".to_owned())));
        assert_eq!(secret_of(r#"{"totp":null}"#), Ok(None));
        assert!(secret_of(r#"{"totp":{}}"#).is_err());
        assert!(secret_of("not json").is_err());
    }
}
