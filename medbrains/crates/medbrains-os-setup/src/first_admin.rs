//! The first administrator's Kanidm login, in two steps, because a person has to scan a code in between.
//! `begin` makes the person with the password and starts a TOTP; the screen shows its QR code and secret.
//! `finish` checks the 6-digit code from the person's authenticator app and saves password and code together,
//! which `mb_it_admins` requires. The helper does the Kanidm calls; secrets cross only its stdin and stdout.

use std::io::Write;
use std::time::Duration;

use data_encoding::BASE32_NOPAD;
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use qrcodegen::{QrCode, QrCodeEcc};
use serde_json::{Value, json};
use zeroize::Zeroizing;

use crate::child::{self, USUAL_LIMIT};

const ENCRYPTION_GUARD: &str = "/usr/lib/medbrains/require-encrypted-data";
const FIRST_ADMIN: &str = "/usr/lib/medbrains/kanidm-first-admin";
/// This service's sandbox can't switch users or write Kanidm's folder, and should not. So these helpers run
/// as transient units, and `--pipe` connects them to this process's pipes: secrets still only cross stdin.
const TRANSIENT: [&str; 5] = ["systemd-run", "--wait", "--pipe", "--quiet", "--collect"];
/// Kanidm's first start, with room for a slow machine, and well inside what the screen will wait.
const FIRST_ADMIN_LIMIT: Duration = Duration::from_secs(120);
const CODE_DIGITS: usize = 6;
/// How the secret is grouped for typing by hand. Authenticator apps ignore the spaces.
const SECRET_GROUP: usize = 4;

/// What became of `begin`.
pub(crate) enum Begun {
    /// The QR code and secret for the screen, as `{ secret, qr }`. Holds the secret: wipe it after use.
    Enrol(Value),
    /// Kanidm's own check said no. Nothing is left behind.
    PasswordRefused,
    /// A release image won't run Kanidm on an unencrypted disk, so there is only local sign-in.
    NoProviderOnThisDisk,
    /// In plain words. Nothing is left behind, and setup can be tried again.
    Failed(String),
}

/// What became of `finish`.
pub(crate) enum Finished {
    Made,
    NoProviderOnThisDisk,
    /// The code was not the one the app shows now. The same QR code stays good: try again.
    WrongCode,
    /// The code step is gone (Kanidm restarted, or 15 minutes passed): start again for a new QR code.
    Expired,
    Failed(String),
}

/// True if this machine runs Kanidm at all.
fn provider_runs() -> bool {
    let may_run = child::run(
        TRANSIENT[0],
        &[&TRANSIENT[1..], &[ENCRYPTION_GUARD]].concat(),
        USUAL_LIMIT,
    )
    .is_some_and(|done| done.success);
    if !may_run {
        log_line("the identity provider is off: this disk is not encrypted");
    }
    may_run
}

/// Runs one step of the helper, these lines on its stdin.
fn run_step(step: &str, input: &str) -> Option<child::Finished> {
    let args = [&TRANSIENT[1..], &[FIRST_ADMIN, step]].concat();
    child::run_with_input(TRANSIENT[0], &args, input.as_bytes(), FIRST_ADMIN_LIMIT)
}

/// Logs why a step failed, and returns the sentence for the screen.
fn failure(done: Option<&child::Finished>) -> String {
    let reason = done.map_or_else(
        || "it took too long".to_owned(),
        |done| String::from_utf8_lossy(&done.stderr).trim().to_owned(),
    );
    log_line(&format!(
        "the first administrator's login was not made: {reason}"
    ));
    "The sign-in service could not make your login, so nothing was saved. Try again.".to_owned()
}

/// Makes the person with this password and starts their TOTP. Safe to repeat: each call starts afresh.
pub(crate) fn begin(username: &str, password: &str) -> Begun {
    if !provider_runs() {
        return Begun::NoProviderOnThisDisk;
    }
    let input = Zeroizing::new(format!("{username}\n{password}\n"));
    let Some(done) = run_step("begin", &input) else {
        return Begun::Failed(failure(None));
    };
    let stdout = Zeroizing::new(done.stdout.clone());
    if done.success {
        return enrolment(&stdout)
            .map_or_else(|| Begun::Failed(failure(Some(&done))), Begun::Enrol);
    }
    if String::from_utf8_lossy(&done.stderr).contains("refused the password") {
        return Begun::PasswordRefused;
    }
    Begun::Failed(failure(Some(&done)))
}

/// Checks the code and saves the login. Only then is the machine started.
pub(crate) fn finish(username: &str, code: &str) -> Finished {
    if !provider_runs() {
        return Finished::NoProviderOnThisDisk;
    }
    if !is_code(code) {
        return Finished::WrongCode;
    }
    let done = run_step("finish", &format!("{username}\n{code}\n"));
    let said = |words| {
        done.as_ref()
            .is_some_and(|done| String::from_utf8_lossy(&done.stderr).contains(words))
    };
    match &done {
        Some(done) if done.success => Finished::Made,
        _ if said("did not match") => Finished::WrongCode,
        _ if said("expired") => Finished::Expired,
        other => Finished::Failed(failure(other.as_ref())),
    }
}

/// Six digits, nothing else.
fn is_code(code: &str) -> bool {
    code.len() == CODE_DIGITS && code.bytes().all(|byte| byte.is_ascii_digit())
}

/// The screen's view of Kanidm's TOTP status: the secret as text and its `otpauth:` URI as a QR code, the
/// way Kanidm's own page builds it. `None` if the status holds no TOTP.
fn enrolment(status: &[u8]) -> Option<Value> {
    let mut status: Value = serde_json::from_slice(status).ok()?;
    let answer = enrolment_of(status.pointer("/mfaregstate/TotpCheck")?);
    crate::scrub(&mut status);
    answer
}

/// The same, from the `TotpCheck` object.
fn enrolment_of(totp: &Value) -> Option<Value> {
    let bytes = Zeroizing::new(
        totp.get("secret")?
            .as_array()?
            .iter()
            .map(|byte| byte.as_u64().and_then(|byte| u8::try_from(byte).ok()))
            .collect::<Option<Vec<u8>>>()?,
    );
    let secret = Zeroizing::new(BASE32_NOPAD.encode(&bytes));
    let text = |key| {
        totp.get(key)
            .and_then(Value::as_str)
            .map(|v| utf8_percent_encode(v, NON_ALPHANUMERIC).to_string())
    };
    let number = |key| totp.get(key).and_then(Value::as_u64);
    let (issuer, account) = (text("issuer")?, text("accountname")?);
    let uri = Zeroizing::new(format!(
        "otpauth://totp/{issuer}:{account}?secret={}&issuer={issuer}&algorithm={}&digits={}&period={}",
        secret.as_str(),
        totp.get("algo")?.as_str()?,
        number("digits")?,
        number("step")?,
    ));
    let qr = QrCode::encode_text(&uri, QrCodeEcc::Medium).ok()?;
    let rows: Vec<String> = (0..qr.size())
        .map(|y| {
            (0..qr.size())
                .map(|x| if qr.get_module(x, y) { '1' } else { '0' })
                .collect()
        })
        .collect();
    Some(json!({ "secret": grouped(&secret), "qr": rows }))
}

/// The secret in groups of four, for typing by hand.
fn grouped(secret: &str) -> String {
    secret
        .as_bytes()
        .chunks(SECRET_GROUP)
        .map(|group| String::from_utf8_lossy(group))
        .collect::<Vec<_>>()
        .join(" ")
}

/// One line for the journal. This service has no logging crate. Never a secret.
fn log_line(line: &str) {
    drop(writeln!(std::io::stderr(), "{line}"));
}

#[cfg(test)]
mod tests {
    use super::{enrolment, grouped, is_code};
    use serde_json::json;

    /// Kanidm's status for a TOTP becomes a secret to type and a QR code, and nothing else.
    #[test]
    fn a_totp_status_becomes_a_secret_and_a_qr_code() {
        let status = json!({ "mfaregstate": { "TotpCheck": {
            "accountname": "asha_admin", "issuer": "idm.medbrains.local", "secret": [72, 101, 108, 108, 111, 33, 222, 173, 190, 239],
            "algo": "SHA256", "step": 30, "digits": 6 } } });
        let answer = enrolment(status.to_string().as_bytes());
        let answer = answer.as_ref();
        assert_eq!(
            answer.and_then(|a| a["secret"].as_str()),
            Some("JBSW Y3DP EHPK 3PXP")
        );
        let rows = answer
            .and_then(|a| a["qr"].as_array())
            .cloned()
            .unwrap_or_default();
        assert!(
            rows.len() >= 21
                && rows
                    .iter()
                    .all(|row| row.as_str().map(str::len) == Some(rows.len()))
        );
        assert_eq!(
            answer.map(|a| a.as_object().map(serde_json::Map::len)),
            Some(Some(2))
        );
    }

    /// A status with no TOTP, or a damaged one, is not an enrolment.
    #[test]
    fn a_status_without_a_totp_is_refused() {
        assert!(enrolment(br#"{"mfaregstate":"None"}"#).is_none());
        assert!(enrolment(br#"{"mfaregstate":{"TotpCheck":{"secret":[300]}}}"#).is_none());
        assert!(enrolment(b"not json").is_none());
    }

    /// Only six digits reach Kanidm.
    #[test]
    fn only_six_digits_are_a_code() {
        assert!(is_code("012345"));
        for bad in ["", "12345", "1234567", "12 345", "12345a", "١٢٣٤٥٦"] {
            assert!(!is_code(bad), "{bad}");
        }
        assert_eq!(grouped("ABCDEFGHI"), "ABCD EFGH I");
    }
}
