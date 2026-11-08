//! What a failed request asked for, with the person taken out.
//!
//! A refused save is only debuggable with its payload: which field, which
//! value, which order. So when a request ends in a 4xx or 5xx its query and
//! JSON body are logged — after every personal (PII) and financial (FII)
//! value is masked. Keys and structure stay, clinical values stay; names,
//! contacts, identity numbers, account and card details, credentials and
//! search terms do not. Free text (notes, reasons) goes through the same
//! redactor that guards AI calls, so an identifier typed into a note goes too.
//!
//! Only failures are logged, only JSON, only bodies up to `MAX_BODY` with a
//! declared length — an upload or a streamed body passes through untouched.

use axum::body::{Body, Bytes, to_bytes};
use axum::extract::Request;
use axum::http::{StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use medbrains_core::ai_redact::redact_for_record;
use serde_json::Value;

/// Bodies larger than this are not buffered or logged.
const MAX_BODY: usize = 64 * 1024;

const MASK: &str = "[redacted]";

/// Keys whose value is masked wherever the key contains one of these.
const SENSITIVE_PARTS: &[&str] = &[
    "phone",
    "mobile",
    "email",
    "address",
    "aadhaar",
    "aadhar",
    "abha",
    "pan_",
    "dob",
    "birth",
    "password",
    "passcode",
    "otp",
    "token",
    "secret",
    "api_key",
    "card_number",
    "cvv",
    "account_number",
    "account_no",
    "ifsc",
    "upi",
    "passport",
    "voter",
    "pincode",
    "zip",
    "policy_number",
    "member_id",
    "bank",
    "salary",
    "signature",
];

/// Keys masked only on an exact match — `name` is a person on a patient but a
/// test on a lab order, and the person is the one that must not leak.
const SENSITIVE_KEYS: &[&str] = &[
    "name",
    "first_name",
    "middle_name",
    "last_name",
    "full_name",
    "patient_name",
    "guardian_name",
    "father_name",
    "mother_name",
    "spouse_name",
    "nominee_name",
    "display_name",
    "contact",
    "pan",
    "q",
    "search",
    "query",
    "term",
];

fn is_sensitive(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    SENSITIVE_KEYS.contains(&key.as_str()) || SENSITIVE_PARTS.iter().any(|p| key.contains(p))
}

/// Mask sensitive values in place; free text goes through the record redactor.
fn redact(value: &mut Value, today: chrono::NaiveDate) {
    match value {
        Value::Object(map) => {
            for (key, inner) in map.iter_mut() {
                if is_sensitive(key) && !inner.is_null() {
                    *inner = Value::String(MASK.to_owned());
                } else {
                    redact(inner, today);
                }
            }
        }
        Value::Array(items) => items.iter_mut().for_each(|item| redact(item, today)),
        Value::String(text) => *text = redact_for_record(text, today),
        Value::Null | Value::Bool(_) | Value::Number(_) => {}
    }
}

fn redact_body(bytes: &Bytes, today: chrono::NaiveDate) -> String {
    serde_json::from_slice::<Value>(bytes).map_or_else(
        |_| "[not json]".to_owned(),
        |mut value| {
            redact(&mut value, today);
            value.to_string()
        },
    )
}

fn redact_query(query: &str, today: chrono::NaiveDate) -> String {
    url::form_urlencoded::parse(query.as_bytes())
        .map(|(key, value)| {
            let shown = if is_sensitive(&key) {
                MASK.to_owned()
            } else {
                redact_for_record(&value, today)
            };
            format!("{key}={shown}")
        })
        .collect::<Vec<_>>()
        .join("&")
}

fn is_small_json(request: &Request) -> bool {
    let headers = request.headers();
    let json = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("application/json"));
    let small = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse::<usize>().ok())
        .is_some_and(|n| n <= MAX_BODY);
    json && small
}

/// Log the redacted query and JSON body of any request that fails.
///
/// Wire in with `axum::middleware::from_fn(log_failed_payload)`, inside the
/// trace layer so the line carries the request's method and path.
pub async fn log_failed_payload(request: Request, next: Next) -> Response {
    let query = request.uri().query().map(str::to_owned);
    let (request, body) = if is_small_json(&request) {
        let (parts, body) = request.into_parts();
        let Ok(bytes) = to_bytes(body, MAX_BODY).await else {
            // The declared length lied or the client went away mid-body.
            return StatusCode::BAD_REQUEST.into_response();
        };
        (
            Request::from_parts(parts, Body::from(bytes.clone())),
            Some(bytes),
        )
    } else {
        (request, None)
    };

    let response = next.run(request).await;
    let status = response.status();
    if (status.is_client_error() || status.is_server_error()) && (query.is_some() || body.is_some())
    {
        let today = chrono::Utc::now().date_naive();
        let query = query.map(|q| redact_query(&q, today)).unwrap_or_default();
        let payload = body.map(|b| redact_body(&b, today)).unwrap_or_default();
        tracing::info!(
            status = status.as_u16(),
            query,
            payload,
            "failed request payload"
        );
    }
    response
}

#[cfg(test)]
mod tests {
    use super::*;

    fn today() -> chrono::NaiveDate {
        chrono::NaiveDate::from_ymd_opt(2026, 10, 31).unwrap_or_default()
    }

    #[test]
    fn personal_and_financial_values_are_masked_but_the_order_is_kept() {
        let body = Bytes::from_static(
            br#"{"patient":{"name":"Ravi Kumar","phone":"9876543210","aadhaar_number":"123412341234"},
                "payment":{"upi_id":"ravi@okbank","card_number":"4111111111111111","amount":450},
                "tests":[{"name":"CBC","loinc_code":"58410-2","priority":"stat"}],
                "patient_name":"Ravi Kumar"}"#,
        );
        let shown = redact_body(&body, today());

        for leaked in [
            "Ravi",
            "9876543210",
            "123412341234",
            "ravi@okbank",
            "4111111111111111",
        ] {
            assert!(!shown.contains(leaked), "{leaked} leaked: {shown}");
        }
        // What is needed to debug the failure survives.
        for kept in ["58410-2", "stat", "450", "loinc_code", "priority"] {
            assert!(shown.contains(kept), "{kept} lost: {shown}");
        }
    }

    #[test]
    fn a_search_term_never_reaches_the_log() {
        let shown = redact_query("q=Ravi%20Kumar&status=pending&page=2", today());
        assert!(!shown.contains("Ravi"), "{shown}");
        assert!(
            shown.contains("status=pending") && shown.contains("page=2"),
            "{shown}"
        );
    }

    #[test]
    fn a_body_that_is_not_json_is_not_echoed() {
        assert_eq!(
            redact_body(&Bytes::from_static(b"name=Ravi"), today()),
            "[not json]"
        );
    }
}
