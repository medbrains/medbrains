//! What leaves the server under a grant.
//!
//! Every grant: only JSON answers. A file, an image or a stream cannot be
//! described by the event row or masked, so a successful non-JSON answer is
//! refused — before any of it is read, so a stream is never buffered.
//!
//! A masked grant: the answer is masked by **allowlist**. A value survives
//! only when its key and its shape both say it is safe — an id that is a
//! UUID, a timestamp that parses as one, a count that is a number, a boolean
//! flag, a status or type that is a short enum word with nothing a redactor
//! would catch in it. Everything else becomes `[MASKED]`, under whatever key
//! it hides: `name`, `display_name`, `patientLabel`, free text, a number that
//! is an age. Restricted clinical records are withheld whole first. Error
//! bodies are masked too: a refusal can name the patient it refused.

use std::sync::LazyLock;

use axum::{
    body::Body,
    http::{HeaderValue, header},
    response::{IntoResponse, Response},
};
use http_body::Body as _;
use serde_json::Value;
use std::collections::HashSet;

use crate::error::AppError;

/// The marker a masked value becomes. Nothing of the value, not even its
/// length, leaves the server.
const MASK: &str = "[MASKED]";

/// The largest JSON answer masked in memory (32 MiB); a larger one is refused.
const MASK_LIMIT: usize = 32 * 1024 * 1024;

/// The longest enum-like value kept.
const ENUM_MAX: usize = 64;

/// Keys that are always masked, whatever their shape: every identity field
/// the AI door pseudonymises (`abha_id` ends in `_id` but is not an id).
static IDENTITY_KEYS: LazyLock<HashSet<&'static str>> =
    LazyLock::new(|| medbrains_core::ai_redact::identity_field_names().collect());

/// Exact keys whose value is a count or page figure.
const COUNT_KEYS: &[&str] = &[
    "total", "count", "page", "limit", "per_page", "offset", "version",
];

/// Exact keys whose value is an enum word.
const ENUM_KEYS: &[&str] = &[
    "status", "state", "kind", "type", "category", "priority", "severity", "phase", "method",
    "module", "role", "scope", "level", "code",
];

/// The `error` codes the server's own error bodies use (`AppError`). Any
/// other value under `error` is a message, and is masked.
const ERROR_CODES: &[&str] = &[
    "unauthorized",
    "forbidden",
    "step_up_required",
    "not found",
    "not implemented",
    "bad request",
    "conflict",
    "too many requests",
    "service unavailable",
    "internal error",
    "validation_failed",
];

/// Key fragments that make a value clinical or personal however it is shaped.
const NEVER_KEPT_FRAGMENTS: &[&str] = &[
    "birth", "dob", "lmp", "death", "icd", "diagnos", "snomed", "loinc", "atc", "drug",
];

/// Guard one answer to a request made under a grant.
pub(super) async fn guard_response(response: Response, is_masked: bool) -> Response {
    let content_type = response
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let is_json = content_type.starts_with("application/json");
    let is_empty = response.body().size_hint().exact() == Some(0);
    if !is_json && !is_empty && response.status().is_success() {
        return refuse("Files, downloads and live streams are not available to MedBrains access.");
    }
    if !is_masked || is_empty {
        return response;
    }
    if !is_json {
        // An error page that is not JSON: its status says enough.
        let (parts, _) = response.into_parts();
        return Response::from_parts(parts, Body::from("Request refused."));
    }
    mask_json_response(response).await
}

/// Buffer, mask and re-send a JSON answer.
async fn mask_json_response(response: Response) -> Response {
    let (mut parts, body) = response.into_parts();
    let Ok(bytes) = axum::body::to_bytes(body, MASK_LIMIT).await else {
        return refuse("This answer is too large to mask.");
    };
    let Ok(mut value) = serde_json::from_slice::<Value>(&bytes) else {
        return refuse("This answer could not be masked.");
    };
    if let Err(e) = mask_value(&mut value) {
        tracing::error!(error = %e, "masking failed; refusing as 503");
        return AppError::ServiceUnavailable("The answer could not be masked".to_owned())
            .into_response();
    }
    let Ok(masked) = serde_json::to_vec(&value) else {
        return refuse("This answer could not be masked.");
    };
    if let Ok(len) = HeaderValue::from_str(&masked.len().to_string()) {
        parts.headers.insert(header::CONTENT_LENGTH, len);
    }
    Response::from_parts(parts, Body::from(masked))
}

/// The 403 for an answer a grant may not have.
fn refuse(reason: &str) -> Response {
    AppError::ForbiddenReason(reason.to_owned()).into_response()
}

/// Mask `value` for a masked grant. Returns how many values were masked or
/// withheld.
///
/// # Errors
/// The sensitive-class markers could not be compiled — the caller must refuse.
pub fn mask_value(value: &mut Value) -> Result<usize, String> {
    let withheld = medbrains_core::ai_redact::sensitive::withhold_in_json(value)?;
    let today = chrono::Utc::now().date_naive();
    Ok(withheld + walk(value, None, today))
}

/// Mask every value under `key` (the parent key, for array elements and the
/// root) that is not kept.
fn walk(value: &mut Value, key: Option<&str>, today: chrono::NaiveDate) -> usize {
    match value {
        Value::Object(map) => {
            let renamed = mask_keys(map);
            renamed
                + map
                    .iter_mut()
                    .map(|(k, v)| walk(v, Some(k.as_str()), today))
                    .sum::<usize>()
        }
        Value::Array(items) => items.iter_mut().map(|v| walk(v, key, today)).sum(),
        scalar => {
            if key.is_some_and(|k| keep(&snake(k), scalar, today)) {
                0
            } else {
                *scalar = Value::String(MASK.to_owned());
                1
            }
        }
    }
}

/// Rename every key that is data rather than a field name — a map keyed by a
/// patient's name or phone — to `masked_1`, `masked_2`, … Kept: keys shaped
/// like a field name (`first_name`, `displayName`, at most 64 ASCII
/// characters, starting with a lower-case letter) and UUIDs (maps keyed by
/// id). Returns how many keys were renamed.
fn mask_keys(map: &mut serde_json::Map<String, Value>) -> usize {
    let data_keys: Vec<String> = map.keys().filter(|k| !is_field_name(k)).cloned().collect();
    for (n, key) in data_keys.iter().enumerate() {
        if let Some(v) = map.remove(key) {
            map.insert(format!("masked_{}", n + 1), v);
        }
    }
    data_keys.len()
}

/// A key shaped like a schema field name, or a UUID.
fn is_field_name(key: &str) -> bool {
    if uuid::Uuid::parse_str(key).is_ok() {
        return true;
    }
    let mut chars = key.chars();
    key.len() <= ENUM_MAX
        && chars.next().is_some_and(|c| c.is_ascii_lowercase())
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// `displayName` → `display_name`, so camelCase keys meet the same rules.
fn snake(key: &str) -> String {
    let mut out = String::with_capacity(key.len() + 4);
    for c in key.chars() {
        if c.is_ascii_uppercase() {
            if !out.is_empty() {
                out.push('_');
            }
            out.push(c.to_ascii_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

/// Whether a scalar under `key` (already snake case) is safe to show.
fn keep(key: &str, value: &Value, today: chrono::NaiveDate) -> bool {
    if IDENTITY_KEYS.contains(key) || NEVER_KEPT_FRAGMENTS.iter().any(|f| key.contains(f)) {
        return false;
    }
    match value {
        Value::Null => true,
        Value::Bool(_) => is_flag_key(key),
        Value::Number(_) => is_id_key(key) || is_count_key(key),
        Value::String(s) => {
            if is_id_key(key) {
                uuid::Uuid::parse_str(s).is_ok()
            } else if is_time_key(key) {
                is_timestamp(s)
            } else if key == "error" {
                ERROR_CODES.contains(&s.as_str())
            } else {
                is_enum_key(key) && is_enum_word(s) && scan_is_clean(s, today)
            }
        }
        Value::Array(_) | Value::Object(_) => false,
    }
}

/// `id`, `patient_id`, `ward_ids`.
fn is_id_key(key: &str) -> bool {
    key == "id" || key.ends_with("_id") || key.ends_with("_ids")
}

/// `total`, `page`, `event_count`.
fn is_count_key(key: &str) -> bool {
    COUNT_KEYS.contains(&key) || key.ends_with("_count")
}

/// `created_at`, `due_on`.
fn is_time_key(key: &str) -> bool {
    key.ends_with("_at") || key.ends_with("_on")
}

/// `is_active`, `has_allergy`. A flag whose name names a restricted class
/// (`is_hiv_positive`) is the disclosure, so it is masked.
fn is_flag_key(key: &str) -> bool {
    let flagged = ["is_", "has_", "can_", "was_", "should_"]
        .iter()
        .any(|p| key.starts_with(p));
    flagged
        && medbrains_core::ai_redact::sensitive::class_of_text(&key.replace('_', " "))
            .is_ok_and(|class| class.is_none())
}

/// `status`, `order_status`, `visit_type`.
fn is_enum_key(key: &str) -> bool {
    ENUM_KEYS.contains(&key)
        || ["_status", "_type", "_kind", "_state", "_code"]
            .iter()
            .any(|s| key.ends_with(s))
}

/// One short word: `in_progress`, `opd.visit`, `B-12`. No spaces.
fn is_enum_word(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= ENUM_MAX
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.' | ':' | '/'))
}

/// An RFC 3339 timestamp or an ISO date.
fn is_timestamp(s: &str) -> bool {
    chrono::DateTime::parse_from_rfc3339(s).is_ok()
        || chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
        || chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.f").is_ok()
}

/// Whether the AI door's value scan finds nothing to redact in `s`.
fn scan_is_clean(s: &str, today: chrono::NaiveDate) -> bool {
    medbrains_core::ai_redact::redact_for_record(s, today) == s
}
