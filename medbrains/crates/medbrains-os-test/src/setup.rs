//! Makes a fresh machine a main machine as the screen's Review does: the first administrator's login, the
//! authenticator code it then asks for, and the hospital. Nothing runs before that. The password and
//! authenticator are made fresh for a machine that is thrown away. The username is not `admin`, which
//! Kanidm keeps, and the password is a phrase, because Kanidm's strength check is what setup applies.

use std::process::Command;
use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::ensure;
use crate::vm::{self, Vm};

const SETUP_SOCKET: &str = "/run/medbrains-console/setup.sock";
const SETUP_LIMIT: Duration = Duration::from_secs(180);
/// The code an authenticator app shows now: Kanidm's default, SHA-256, 30 seconds, 6 digits
/// (`os/tests/kanidm_lib.py`). Computed on the host, whose clock the guest takes at start.
const TOTP: &str = "import base64,hashlib,hmac,struct,sys,time
s=sys.argv[1].replace(' ','');s=base64.b32decode(s+'='*(-len(s)%8))
m=hmac.new(s,struct.pack('>Q',int(time.time()//30)),hashlib.sha256).digest();o=m[-1]&15
print('%06d'%((struct.unpack('>I',m[o:o+4])[0]&0x7fffffff)%1000000))";

/// One call to the setup service, as the screen makes it.
fn call(vm: &mut Vm, path: &str, body: &str) -> Result<String, String> {
    vm.run_for(
        &format!(
            "for i in $(seq 60); do test -S {SETUP_SOCKET} && break; sleep 1; done; \
             curl -s -m 140 --unix-socket {SETUP_SOCKET} -d '{body}' http://machine{path}"
        ),
        SETUP_LIMIT,
    )
}

/// The authenticator secret in setup's first answer, or `None` on a machine with no identity provider.
fn secret_of(answer: &str) -> Option<String> {
    let (_, rest) = answer.split_once("\"secret\":\"")?;
    rest.split_once('"').map(|(secret, _)| secret.to_owned())
}

/// The code the authenticator would show now for `secret`.
fn code_now(secret: &str) -> Result<String, String> {
    let made = Command::new("python3")
        .args(["-I", "-c", TOTP, secret])
        .output()
        .map_err(|e| format!("python3: {e}"))?;
    ensure(
        made.status.success(),
        "the authenticator code could not be made",
    )?;
    Ok(String::from_utf8_lossy(&made.stdout).trim().to_owned())
}

/// Sets the machine up as a main machine.
pub(crate) fn set_up_main(vm: &mut Vm) -> Result<(), String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    let form = format!(
        r#""hospital":"Test Hospital","username":"os_test_admin","password":"Night porter {stamp} keeps blue lanterns""#
    );
    let deadline = Instant::now() + vm::scaled(SETUP_LIMIT);
    while vm.run(&format!("test -S {SETUP_SOCKET}; echo $?"))? != "0" {
        ensure(Instant::now() < deadline, "the setup service never started")?;
        sleep(Duration::from_secs(2));
    }
    let begun = call(vm, "/hospital/admin", &format!("{{{form}}}"))?;
    ensure(
        begun.contains("\"totp\""),
        format!("setup's first step answered {begun}"),
    )?;
    let code = secret_of(&begun).map_or_else(|| Ok(String::new()), |s| code_now(&s))?;
    let answer = call(vm, "/hospital", &format!(r#"{{{form},"code":"{code}"}}"#))?;
    ensure(
        answer.contains("\"ok\":true"),
        format!("setup answered {answer}"),
    )
}

#[cfg(test)]
mod tests {
    use super::secret_of;

    /// The secret is read from setup's answer, and a machine with no identity provider has none.
    #[test]
    fn the_secret_is_read_from_the_first_answer() {
        let answer = r#"{"totp":{"secret":"ABCD EFGH","qr":"<svg/>"}}"#;
        assert_eq!(secret_of(answer).as_deref(), Some("ABCD EFGH"));
        assert_eq!(secret_of(r#"{"totp":null}"#), None);
    }
}
