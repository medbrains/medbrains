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
//! - HFR registration `create-facility` and HPR `POST /api/v1/search/hpr`:
//!   NOT official. The real flows are the four-step `basic-information` …
//!   `submit-facility` and `GET /v1/search/searchByHprId/{hprId}`; until
//!   they are built these answer 404, which is reported as a fault.
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
pub const HFR_REGISTER_PATH: &str = "/FacilityManagement/v1.5/facility/create-facility";
pub const HPR_SEARCH_PATH: &str = "/api/v1/search/hpr";
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

/// Submit a facility registration. Returns the HFR ID when HFR issues one
/// synchronously (it usually issues it only after NHA approval).
pub async fn hfr_register(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    body: &Value,
) -> Result<(Option<String>, Value), AbdmError> {
    let value = post(http, &join(base_url, HFR_REGISTER_PATH), token, body).await?;
    let id = ["facilityId", "id"]
        .iter()
        .find_map(|k| value.get(*k).and_then(Value::as_str))
        .map(str::to_owned);
    Ok((id, value))
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

/// Look an HPR ID up (hyphenated or bare 14 digits both match).
pub async fn hpr_search(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    hpr_id: &str,
) -> Result<Option<RegistryMatch>, AbdmError> {
    let bare: String = hpr_id.chars().filter(char::is_ascii_digit).collect();
    let body = json!({ "hprId": hpr_id, "idNumber": bare });
    let value = post(http, &join(base_url, HPR_SEARCH_PATH), token, &body).await?;
    let hit = find_match(
        &value,
        &["hprIdNumber", "hprId", "idNumber"],
        hpr_id,
        &["name"],
    )
    .or_else(|| {
        find_match(
            &value,
            &["hprIdNumber", "hprId", "idNumber"],
            &bare,
            &["name"],
        )
    });
    Ok(hit)
}

fn join(base: &str, path: &str) -> String {
    format!("{}{path}", base.trim_end_matches('/'))
}

async fn post(
    http: &reqwest::Client,
    url: &str,
    token: &str,
    body: &Value,
) -> Result<Value, AbdmError> {
    let response = http
        .post(url)
        .bearer_auth(token)
        .header("REQUEST-ID", uuid::Uuid::new_v4().to_string())
        .header(
            "TIMESTAMP",
            chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        )
        .json(body)
        .send()
        .await?;
    let status = response.status();
    if !status.is_success() {
        let body = response.text().await?;
        return Err(AbdmError::Status { status, message: abdm_message(&body) });
    }
    Ok(response.json::<Value>().await?)
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
}
