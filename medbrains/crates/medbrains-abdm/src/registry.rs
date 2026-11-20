//! ABDM Milestone 4 — HFR (facilities) and HPR (professionals) registry calls.
//!
//! Every call takes the gateway session token as an argument. Where that
//! token comes from (env/tenant ABHA credentials today, the sealed per-tenant
//! settings and `connect()` once that lands) is the caller's business, so the
//! two can be wired together without touching this file.
//!
//! Hosts (2026-10, official): HFR and HPR share one API host,
//! `https://apihspsbx.abdm.gov.in/v4/int` in the sandbox and
//! `https://apinhpr.abdm.gov.in/v4/int` in production — the live API docs at
//! `apihspsbx.abdm.gov.in/v4/int/v3/api-docs/HFR` and the HFR documentation
//! (`sandboxcms.abdm.gov.in/uploads/HFR_Documentation_PROD_Updated_08_04_2026_…pdf`).
//! `facility*.abdm.gov.in` and `hpr*.abdm.gov.in` are the portals, not APIs.
//!
//! Paths:
//! - HFR facility search `POST /FacilityManagement/v1.5/facility/search`: official.
//! - HFR bridge linkage `POST /v1/bridges/MutipleHRPAddUpdateServices`
//!   (sic): official (HFR documentation, "Link bridge with facility").
//! - HPR search `GET /v1/search/searchByHprId/{hprId}`: official.
//! - HFR registration: the four official calls `basic-information` …
//!   `submit-facility`, in [`crate::hfr_onboarding`].
//!
//! A registry that answers anything but 2xx is a fault (`Err`), never "not
//! registered": only a 2xx that does not list the ID is a refusal.

use serde_json::{Value, json};

use crate::abha::{AbdmEnvironment, AbdmError, abdm_message};

pub const HFR_SANDBOX_BASE_URL: &str = "https://apihspsbx.abdm.gov.in/v4/int";
pub const HFR_PRODUCTION_BASE_URL: &str = "https://apinhpr.abdm.gov.in/v4/int";
pub const HPR_SANDBOX_BASE_URL: &str = HFR_SANDBOX_BASE_URL;
pub const HPR_PRODUCTION_BASE_URL: &str = HFR_PRODUCTION_BASE_URL;

pub const HFR_SEARCH_PATH: &str = "/FacilityManagement/v1.5/facility/search";
/// `GET {HPR_SEARCH_PATH}/{hprId}`.
pub const HPR_SEARCH_PATH: &str = "/v1/search/searchByHprId";
pub const HFR_BRIDGE_LINK_PATH: &str = "/v1/bridges/MutipleHRPAddUpdateServices";

/// Nesting depth searched for a matching record in a registry response. The
/// response shapes are not all published; this bounds the walk.
const MAX_RESPONSE_DEPTH: usize = 4;

#[must_use]
pub const fn hfr_default_base(env: &AbdmEnvironment) -> &'static str {
    match env {
        AbdmEnvironment::Sandbox => HFR_SANDBOX_BASE_URL,
        AbdmEnvironment::Production => HFR_PRODUCTION_BASE_URL,
    }
}

#[must_use]
pub const fn hpr_default_base(env: &AbdmEnvironment) -> &'static str {
    match env {
        AbdmEnvironment::Sandbox => HPR_SANDBOX_BASE_URL,
        AbdmEnvironment::Production => HPR_PRODUCTION_BASE_URL,
    }
}

/// What a registry said about one ID.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegistryMatch {
    pub name: Option<String>,
    pub status: Option<String>,
}

/// Look an HFR facility ID up. `Ok(None)` means HFR answered and does not
/// list the ID — a refusal, distinct from an `Err` (HFR unreachable, or any
/// non-2xx answer, 404 included).
pub async fn hfr_search(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    facility_id: &str,
) -> Result<Option<RegistryMatch>, AbdmError> {
    let body = json!({ "facilityId": facility_id, "page": 1, "resultsPerPage": 10 });
    let value = post(http, &join(base_url, HFR_SEARCH_PATH), token, &body).await?;
    Ok(find_match(
        &value,
        &["facilityId", "id"],
        facility_id,
        &["facilityName", "name"],
    ))
}

/// Bind our bridge to a facility as HIP and HIU (HFR test cases
/// HFR-118..123). HFR answers 200 with one item per HRP: `servicesLinked`
/// or `error` — the caller reads them.
pub async fn hfr_link_bridge(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    body: &Value,
) -> Result<Value, AbdmError> {
    post(http, &join(base_url, HFR_BRIDGE_LINK_PATH), token, body).await
}

/// Look an HPR ID up on the official path (hyphenated or bare 14 digits
/// both match). HPR answers an array of accounts.
pub async fn hpr_search(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    hpr_id: &str,
) -> Result<Option<RegistryMatch>, AbdmError> {
    let bare: String = hpr_id.chars().filter(char::is_ascii_digit).collect();
    let url = format!("{}/{hpr_id}", join(base_url, HPR_SEARCH_PATH));
    let value = send(http, reqwest::Method::GET, &url, token, &[], None).await?;
    Ok(hpr_match(&value, hpr_id, &bare))
}

/// The account in an HPR search answer whose number is `hpr_id` or `bare`.
fn hpr_match(value: &Value, hpr_id: &str, bare: &str) -> Option<RegistryMatch> {
    let keys = ["hprIdNumber", "hprId", "idNumber"];
    find_match(value, &keys, hpr_id, &["name"])
        .or_else(|| find_match(value, &keys, bare, &["name"]))
}

/// The official HFR search (HFR-001…009), one page of hits. `page` and
/// `resultsPerPage` are fixed at 1 and 10: the workbook says the user never
/// fills them.
pub async fn hfr_search_page(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    query: &crate::hfr_onboarding::FacilitySearch,
) -> Result<crate::hfr_onboarding::SearchPage, AbdmError> {
    let value = post(http, &join(base_url, HFR_SEARCH_PATH), token, &query.body()).await?;
    Ok(crate::hfr_onboarding::SearchPage::read(&value))
}

/// `base` and `path` with exactly one slash between them.
pub(crate) fn join(base: &str, path: &str) -> String {
    format!("{}{path}", base.trim_end_matches('/'))
}

/// POST a JSON body with the gateway token; see [`send`].
pub(crate) async fn post(
    http: &reqwest::Client,
    url: &str,
    token: &str,
    body: &Value,
) -> Result<Value, AbdmError> {
    send(http, reqwest::Method::POST, url, token, &[], Some(body)).await
}

/// One registry call: the gateway token as Bearer, a fresh `REQUEST-ID`,
/// `extra` headers (the HPR tokens), and the JSON answer. Any non-2xx is
/// an `Err`, never an empty answer.
pub(crate) async fn send(
    http: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    token: &str,
    extra: &[(&str, &str)],
    body: Option<&Value>,
) -> Result<Value, AbdmError> {
    let text = send_text(http, method, url, token, extra, body).await?;
    serde_json::from_str(&text).map_err(|_| AbdmError::Status {
        status: reqwest::StatusCode::BAD_GATEWAY,
        message: "the registry answered something that is not JSON".to_owned(),
    })
}

/// [`send`], returning the body as text (HPR's certificate is not JSON).
pub(crate) async fn send_text(
    http: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    token: &str,
    extra: &[(&str, &str)],
    body: Option<&Value>,
) -> Result<String, AbdmError> {
    let mut request = http
        .request(method, url)
        .bearer_auth(token)
        .header("REQUEST-ID", uuid::Uuid::new_v4().to_string())
        .header(
            "TIMESTAMP",
            chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        );
    for (name, value) in extra {
        request = request.header(*name, *value);
    }
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request.send().await?;
    let status = response.status();
    let text = response.text().await?;
    if !status.is_success() {
        return Err(AbdmError::Status {
            status,
            message: abdm_message(&text),
        });
    }
    Ok(text)
}

/// The first object (depth-bounded) whose `id_keys` field equals `target`.
fn find_match(
    value: &Value,
    id_keys: &[&str],
    target: &str,
    name_keys: &[&str],
) -> Option<RegistryMatch> {
    find_object(value, id_keys, target, MAX_RESPONSE_DEPTH).map(|obj| RegistryMatch {
        name: name_keys
            .iter()
            .find_map(|k| obj.get(*k).and_then(Value::as_str))
            .map(str::to_owned),
        status: ["facilityStatus", "status"]
            .iter()
            .find_map(|k| obj.get(*k).and_then(Value::as_str))
            .map(str::to_owned),
    })
}

fn find_object<'a>(
    value: &'a Value,
    keys: &[&str],
    target: &str,
    depth: usize,
) -> Option<&'a Value> {
    let matches = |v: &Value| {
        keys.iter().any(|k| {
            v.get(*k)
                .and_then(Value::as_str)
                .is_some_and(|s| s.eq_ignore_ascii_case(target))
        })
    };
    if matches(value) {
        return Some(value);
    }
    if depth == 0 {
        return None;
    }
    match value {
        Value::Array(items) => items
            .iter()
            .find_map(|v| find_object(v, keys, target, depth - 1)),
        Value::Object(map) => map
            .values()
            .find_map(|v| find_object(v, keys, target, depth - 1)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_facility_in_search_page() {
        let body = json!({ "facilities": [
            { "facilityId": "IN0410000183", "facilityName": "City Hospital", "facilityStatus": "Approved" }
        ], "totalFacilities": 1 });
        let hit = find_match(&body, &["facilityId"], "IN0410000183", &["facilityName"]);
        assert_eq!(
            hit,
            Some(RegistryMatch {
                name: Some("City Hospital".to_owned()),
                status: Some("Approved".to_owned())
            })
        );
        assert_eq!(
            find_match(&body, &["facilityId"], "IN9999999999", &["facilityName"]),
            None
        );
        assert_eq!(
            find_match(&Value::Null, &["facilityId"], "IN0410000183", &[]),
            None
        );
    }

    /// HPR's official search answers an array; the number matches hyphenated
    /// or bare, and an empty array is "not listed", not a fault.
    #[test]
    fn finds_professional_in_official_hpr_answer() {
        let body =
            json!([{ "hprIdNumber": "71-1234-5678-9012", "name": "Dr A", "hprId": "a@hpr.abdm" }]);
        let hit = hpr_match(&body, "71-1234-5678-9012", "71123456789012");
        assert_eq!(hit.and_then(|m| m.name).as_deref(), Some("Dr A"));
        let bare = json!([{ "hprIdNumber": "71123456789012", "name": "Dr B" }]);
        assert!(hpr_match(&bare, "71-1234-5678-9012", "71123456789012").is_some());
        assert!(hpr_match(&json!([]), "71-1234-5678-9012", "71123456789012").is_none());
    }
}
