//! Reads the hospital QR the appliance screen shows — the same
//! `medbrains://bind?t=<JWS>` code the staff and patient phone apps scan
//! (`medbrains-device-pairing::binding_token`, `apps/android/kit/HospitalBinding.kt`).
//!
//! The desktop takes only the hospital's name and server address from it. It
//! does not redeem the code or pin the server's TLS key the way the phone apps
//! do: the window is a system webview, which trusts the OS certificate store
//! and cannot be pinned. So the signature is not checked either — with the
//! issuer key carried inside the code and no redeem to prove the server holds
//! it, a valid signature would prove nothing. Trust comes from https and from
//! the person confirming the address the setup screen shows them. For the
//! same reason the code's expiry is not checked: anyone can write a fresh one.

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::{Deserialize, Serialize};

use super::server::{self, ServerError};

/// What the QR text starts with; the token follows.
const QR_PREFIX: &str = "medbrains://bind?t=";
/// The JWS `typ` that marks a binding token.
const TOKEN_TYPE: &str = "mb-binding+jws";
/// The audience every binding token names.
const AUDIENCE: &str = "medbrains-app";
/// The payload version this build reads.
const VERSION: u8 = 1;

#[derive(Deserialize)]
struct Header {
    typ: String,
}

#[derive(Deserialize)]
struct Claims {
    v: u8,
    aud: String,
    tenant_name: String,
    api_base: String,
}

/// The hospital a QR names, for the person to confirm before connecting. The
/// name is unverified text from the code; only the address is checked.
#[derive(Debug, Serialize, PartialEq, Eq)]
pub(crate) struct BindingInfo {
    pub(crate) hospital: String,
    pub(crate) address: String,
}

/// Why a hospital QR was refused, in words the person can act on.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub(crate) enum BindingError {
    #[error("This is not a MedBrains hospital code.")]
    NotBinding,
    #[error("This hospital code is damaged. Ask for a new one.")]
    Damaged,
    #[error("This hospital code is for a different app version.")]
    WrongVersion,
    #[error("{0}")]
    Server(#[from] ServerError),
}

/// Decode a scanned or pasted hospital QR into the hospital and its server.
pub(crate) fn read_binding(code: &str) -> Result<BindingInfo, BindingError> {
    let token = code
        .trim()
        .strip_prefix(QR_PREFIX)
        .ok_or(BindingError::NotBinding)?;
    let mut parts = token.split('.');
    let (Some(header), Some(payload), Some(_signature), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(BindingError::Damaged);
    };
    if decode::<Header>(header)?.typ != TOKEN_TYPE {
        return Err(BindingError::NotBinding);
    }
    let claims = decode::<Claims>(payload)?;
    if claims.v != VERSION || claims.aud != AUDIENCE {
        return Err(BindingError::WrongVersion);
    }
    let address = server::parse_server(&claims.api_base)?;
    Ok(BindingInfo {
        hospital: claims.tenant_name,
        address: server::display(&address),
    })
}

/// Decode one base64url JSON segment of the token.
fn decode<T: for<'de> Deserialize<'de>>(segment: &str) -> Result<T, BindingError> {
    let bytes = URL_SAFE_NO_PAD
        .decode(segment)
        .map_err(|_| BindingError::Damaged)?;
    serde_json::from_slice(&bytes).map_err(|_| BindingError::Damaged)
}

#[cfg(test)]
mod tests {
    use super::{BindingError, BindingInfo, QR_PREFIX, URL_SAFE_NO_PAD, read_binding};
    use base64::Engine;

    fn code(api_base: &str) -> String {
        let header = URL_SAFE_NO_PAD.encode(r#"{"alg":"EdDSA","typ":"mb-binding+jws","kid":"k"}"#);
        let payload = URL_SAFE_NO_PAD.encode(format!(
            r#"{{"v":1,"iss":"x","aud":"medbrains-app","tenant":"t","tenant_name":"City Hospital","api_base":"{api_base}","ik":"k","jti":"j","iat":0,"exp":0}}"#
        ));
        format!("{QR_PREFIX}{header}.{payload}.c2ln")
    }

    #[test]
    fn a_hospital_code_names_the_hospital_and_its_server() {
        assert_eq!(
            read_binding(&code("https://hims.example.org/")),
            Ok(BindingInfo {
                hospital: "City Hospital".into(),
                address: "https://hims.example.org".into(),
            })
        );
    }

    #[test]
    fn a_foreign_damaged_or_cleartext_code_is_refused() {
        assert_eq!(
            read_binding("https://h.example.org"),
            Err(BindingError::NotBinding)
        );
        assert_eq!(
            read_binding(&format!("{QR_PREFIX}a.b")),
            Err(BindingError::Damaged)
        );
        assert!(matches!(
            read_binding(&code("http://h.example.org")),
            Err(BindingError::Server(_))
        ));
        assert!(matches!(
            read_binding(&code("https://*.example.org")),
            Err(BindingError::Server(_))
        ));
    }
}
