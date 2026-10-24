//! Reading the QR on a patient's ABHA card at the desk (M1 test case
//! VRFY_ABHA_501, "Reading ABHA Profile Info using ABHA QR Code").
//!
//! The QR carries the ABHA number, address and demographics as JSON (keys
//! `hidn`, `hid`, `name`, `gender`, `dob`, `mobile`, … on the cards ABDM
//! prints; other issuers spell them differently, so several spellings are
//! read). A printed card proves nothing — anyone can print one — so this
//! only reads it: the desk then verifies the ABHA it names by OTP, and only
//! that verification can register or link a patient.

use axum::{Extension, Json};
use medbrains_core::permissions;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::abha_common::{abha_number_display, gender_name};
use crate::{
    error::AppError, middleware::auth::Claims, middleware::authorization::require_permission,
};

/// A QR holds a few hundred bytes; anything far larger is not an ABHA card.
const MAX_PAYLOAD: usize = 4_096;

#[derive(Debug, Deserialize)]
pub struct QrPayload {
    pub payload: String,
}

/// What the card says, to verify by OTP. Nothing here is trusted.
#[derive(Debug, Default, PartialEq, Eq, Serialize)]
pub struct AbhaCardQr {
    pub abha_number: Option<String>,
    pub abha_address: Option<String>,
    pub name: Option<String>,
    /// `male`, `female` or `other`.
    pub gender: Option<String>,
    /// As printed: `DD-MM-YYYY` or `D/M/YYYY`.
    pub date_of_birth: Option<String>,
    pub mobile: Option<String>,
}

fn field(v: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|k| {
        let text = match &v[*k] {
            Value::String(s) => s.trim().to_owned(),
            Value::Number(n) => n.to_string(),
            _ => return None,
        };
        (!text.is_empty()).then_some(text)
    })
}

/// A 14-digit ABHA number anywhere in `text`, in ABDM's display form.
fn number_in(text: &str) -> Option<String> {
    text.split(|c: char| !(c.is_ascii_digit() || c == '-' || c == ' '))
        .find_map(abha_number_display)
}

/// `name@abdm` or `name@sbx` anywhere in `text`.
fn address_in(text: &str) -> Option<String> {
    text.split(|c: char| c.is_whitespace() || matches!(c, '"' | ',' | '{' | '}' | ':'))
        .find(|w| w.ends_with("@abdm") || w.ends_with("@sbx"))
        .map(str::to_ascii_lowercase)
}

/// Read a scanned ABHA card QR.
#[must_use]
pub fn read_card(payload: &str) -> AbhaCardQr {
    let Ok(v) = serde_json::from_str::<Value>(payload) else {
        return AbhaCardQr {
            abha_number: number_in(payload),
            abha_address: address_in(payload),
            ..AbhaCardQr::default()
        };
    };
    AbhaCardQr {
        abha_number: field(
            &v,
            &[
                "hidn",
                "abhaNumber",
                "abha_number",
                "ABHANumber",
                "healthIdNumber",
            ],
        )
        .and_then(|n| abha_number_display(&n)),
        abha_address: field(
            &v,
            &["hid", "phr", "abhaAddress", "abha_address", "healthId"],
        )
        .map(|a| a.to_ascii_lowercase())
        .filter(|a| a.contains('@')),
        name: field(&v, &["name", "fullName", "full_name"]),
        gender: field(&v, &["gender", "sex"]).map(|g| gender_name(&g).to_owned()),
        date_of_birth: field(&v, &["dob", "dateOfBirth", "date_of_birth"]),
        mobile: field(&v, &["mobile", "mobileNumber", "phone"]),
    }
}

/// `POST /api/abdm/abha/qr` — what a scanned ABHA card says, to verify next.
///
/// # Errors
/// 403 without `abdm.abha.manage`; 400 when the QR is not an ABHA card.
#[tracing::instrument(skip_all, fields(tenant_id = %claims.tenant_id))]
pub async fn read(
    Extension(claims): Extension<Claims>,
    Json(body): Json<QrPayload>,
) -> Result<Json<AbhaCardQr>, AppError> {
    require_permission(&claims, permissions::abdm::abha::MANAGE)?;
    if body.payload.len() > MAX_PAYLOAD {
        return Err(AppError::BadRequest(
            "that QR is not an ABHA card".to_owned(),
        ));
    }
    let card = read_card(&body.payload);
    if card.abha_number.is_none() && card.abha_address.is_none() {
        return Err(AppError::BadRequest(
            "that QR is not an ABHA card — scan the QR printed on the patient's ABHA card"
                .to_owned(),
        ));
    }
    Ok(Json(card))
}

#[cfg(test)]
mod tests {
    use super::read_card;

    /// The JSON ABDM prints on an ABHA card.
    #[test]
    fn an_abha_card_qr_is_read() {
        let card = read_card(
            r#"{"hidn":"91-4173-3253-1234","hid":"Priya.V@abdm","name":"Priya V","gender":"F",
                "statelgd":"27","distlgd":"490","dob":"21-11-1990","mobile":"9876543210",
                "address":"Pune","district_name":"PUNE","state name":"MAHARASHTRA"}"#,
        );
        assert_eq!(card.abha_number.as_deref(), Some("91-4173-3253-1234"));
        assert_eq!(card.abha_address.as_deref(), Some("priya.v@abdm"));
        assert_eq!(card.gender.as_deref(), Some("female"));
        assert_eq!(card.date_of_birth.as_deref(), Some("21-11-1990"));
    }

    /// Other spellings, and a QR that is only text, still give the ABHA.
    #[test]
    fn other_spellings_and_plain_text_are_read() {
        let card = read_card(r#"{"abhaNumber":"91417332531234","abhaAddress":"x@sbx"}"#);
        assert_eq!(card.abha_number.as_deref(), Some("91-4173-3253-1234"));
        let text = read_card("ABHA 91-4173-3253-1234 x@abdm");
        assert_eq!(text.abha_number.as_deref(), Some("91-4173-3253-1234"));
        assert_eq!(text.abha_address.as_deref(), Some("x@abdm"));
    }

    /// A shop's UPI QR is not an ABHA card.
    #[test]
    fn another_qr_names_no_abha() {
        let other = read_card("upi://pay?pa=shop@okbank&am=10");
        assert_eq!(other.abha_number, None);
        assert_eq!(other.abha_address, None);
    }
}
