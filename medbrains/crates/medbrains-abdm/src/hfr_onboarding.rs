//! ABDM M4 HFR — the official facility onboarding calls.
//!
//! Order (NHA HFR workbook, "Registration" and "Facility update" sheets, and
//! the M4 API pages): search first (no duplicate facility), then
//! `basic-information` → `additional-information` → `detailed-information`
//! → `submit-facility`. The first basic save sends `trackingId` `""`; HFR
//! answers with the `trackingId` every later call carries. An update is the
//! same calls again with that `trackingId`, then a resubmit.
//!
//! Three tokens: the gateway session as `Authorization`; the facility
//! manager's HPR token as `x-hprid-auth` on basic information and submit; a
//! verifying professional's HPR token as `x-hprid-auth-verifier` on submit.
//! The HPR tokens come from [`hpr_login`] — the password is encrypted under
//! HPR's certificate and never kept.
//!
//! A 200 can still refuse fields: `errorStatus` lists them, and a step whose
//! list is not empty did not save. The field rules the workbook gives live in
//! [`crate::hfr_rules`].

use serde::Serialize;
use serde_json::{Value, json};

use crate::abha::AbdmError;
use crate::hfr_forms::text;
pub use crate::hfr_forms::{
    AddressDetails, ContactInformation, DetailedInformation, FacilityHit, FacilityInformation,
    FacilitySearch, LinkedProgramIds, MedicalInfrastructure, SearchPage, SystemSpecialities,
    Timing,
};
use crate::registry::{join, post, send, send_text};

pub const HFR_BASIC_PATH: &str = "/v1.5/facility/basic-information";
pub const HFR_ADDITIONAL_PATH: &str = "/v1.5/facility/additional-information";
pub const HFR_DETAILED_PATH: &str = "/v1.5/facility/detailed-information";
pub const HFR_SUBMIT_PATH: &str = "/v1.5/facility/submit-facility";
pub const HPR_CERT_PATH: &str = "/api/v1/auth/cert";
pub const HPR_LOGIN_PATH: &str = "/api/v1/auth/authPassword";

/// Header carrying the facility manager's HPR token.
pub const HPRID_AUTH: &str = "x-hprid-auth";
/// Header carrying the verifying professional's HPR token (submit only).
pub const HPRID_AUTH_VERIFIER: &str = "x-hprid-auth-verifier";

/// Master lists are small (a state's districts, a system's specialities);
/// this bounds a runaway answer.
const MAX_MASTER_ITEMS: usize = 2000;

/// HFR's answer to a basic/additional/detailed save.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize)]
pub struct StepOutcome {
    pub tracking_id: Option<String>,
    pub status: Option<String>,
    pub message: Option<String>,
    /// Fields HFR refused. Not empty means the step did not save.
    pub errors: Vec<String>,
}

impl StepOutcome {
    /// Read `{ trackingId, status, message, errorStatus }`; `trackingId` may
    /// be a number or a string.
    #[must_use]
    pub fn read(value: &Value) -> Self {
        let tracking_id = match value.get("trackingId") {
            Some(Value::String(s)) if !s.trim().is_empty() => Some(s.trim().to_owned()),
            Some(Value::Number(n)) => Some(n.to_string()),
            _ => None,
        };
        let errors = value
            .get("errorStatus")
            .and_then(Value::as_array)
            .map(|items| items.iter().filter_map(error_text).collect())
            .unwrap_or_default();
        Self {
            tracking_id,
            status: text(value, "status"),
            message: text(value, "message"),
            errors,
        }
    }

    /// HFR accepted the step: no refused fields.
    #[must_use]
    pub const fn is_saved(&self) -> bool {
        self.errors.is_empty()
    }
}

/// HFR's answer to submit: the facility ID once issued.
#[derive(Clone, Debug, Default, Eq, PartialEq, Serialize)]
pub struct SubmitOutcome {
    pub facility_id: Option<String>,
    pub status: Option<String>,
    pub message: Option<String>,
    pub errors: Vec<String>,
}

impl SubmitOutcome {
    /// Read `{ facilityId, status, message, errorStatus }`.
    #[must_use]
    pub fn read(value: &Value) -> Self {
        let step = StepOutcome::read(value);
        Self {
            facility_id: text(value, "facilityId"),
            status: step.status,
            message: step.message,
            errors: step.errors,
        }
    }
}

/// One option of a master list: the code HFR wants and the name staff read.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct MasterOption {
    pub code: String,
    pub name: String,
}

/// A master list HFR publishes; every dropdown is filled from one, never
/// typed into our source.
#[derive(Clone, Debug)]
pub enum Master {
    States,
    Districts {
        state_code: String,
    },
    SubDistricts {
        district_code: String,
    },
    /// `get-master-data?type=…` (OWNER, FAC-STATUS, WORKING-DAYS, …).
    Data {
        kind: String,
    },
    OwnerSubtypes {
        ownership_code: String,
        owner_subtype_code: String,
    },
    FacilityTypes {
        ownership_code: String,
        system_of_medicine_code: String,
    },
    FacilitySubTypes {
        facility_type_code: String,
    },
    Specialities {
        system_of_medicine_code: String,
    },
}

/// Fetch one master list as `{code, name}` options.
///
/// # Errors
/// Any non-2xx or unreachable registry.
pub async fn hfr_master(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    master: &Master,
) -> Result<Vec<MasterOption>, AbdmError> {
    let get = |path: String| (reqwest::Method::GET, path, None);
    let (method, path, body) = match master {
        Master::States => get("/v1.5/facility/lgd/states".to_owned()),
        Master::Districts { state_code } => get(format!(
            "/v1.5/facility/lgd/districts?stateCode={state_code}"
        )),
        Master::SubDistricts { district_code } => get(format!(
            "/v1.5/facility/lgd/subdistricts?districtCode={district_code}"
        )),
        Master::Data { kind } => get(format!("/v1.5/facility/get-master-data?type={kind}")),
        Master::OwnerSubtypes {
            ownership_code,
            owner_subtype_code,
        } => (
            reqwest::Method::POST,
            "/v1.5/facility/get-owner-subtype".to_owned(),
            Some(
                json!({ "ownershipCode": ownership_code, "ownerSubtypeCode": owner_subtype_code }),
            ),
        ),
        Master::FacilityTypes {
            ownership_code,
            system_of_medicine_code,
        } => (
            reqwest::Method::POST,
            "/v1.5/facility/fetch-facility-type".to_owned(),
            Some(json!({ "ownershipCode": ownership_code,
                         "systemOfMedicineCode": system_of_medicine_code })),
        ),
        Master::FacilitySubTypes { facility_type_code } => (
            reqwest::Method::POST,
            "/v1.5/facility/fetch-facility-Sub-type".to_owned(),
            Some(json!({ "facilityTypeCode": facility_type_code })),
        ),
        Master::Specialities {
            system_of_medicine_code,
        } => (
            reqwest::Method::POST,
            "/v1.5/facility/get-specialities".to_owned(),
            Some(json!({ "systemOfMedicineCode": system_of_medicine_code })),
        ),
    };
    let value = send(
        http,
        method,
        &join(base_url, &path),
        token,
        &[],
        body.as_ref(),
    )
    .await?;
    Ok(read_master(&value))
}

/// Options from a root array, or from `data`; the name is `name`, `value`
/// or `description`, whichever HFR sent.
#[must_use]
pub fn read_master(value: &Value) -> Vec<MasterOption> {
    let items = value
        .as_array()
        .or_else(|| value.get("data").and_then(Value::as_array));
    items
        .map(|items| {
            items
                .iter()
                .take(MAX_MASTER_ITEMS)
                .filter_map(|item| {
                    let code = text(item, "code").or_else(|| text(item, "id"))?;
                    let name = ["name", "value", "description"]
                        .iter()
                        .find_map(|k| text(item, k))
                        .unwrap_or_else(|| code.clone());
                    Some(MasterOption { code, name })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Save basic information with the manager's HPR token. `tracking_id` is
/// `""` on the first save.
///
/// # Errors
/// Any non-2xx or unreachable registry.
pub async fn hfr_save_basic(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    manager_token: &str,
    (tracking_id, info): (&str, &FacilityInformation),
) -> Result<StepOutcome, AbdmError> {
    let body = json!({ "trackingId": tracking_id, "facilityInformation": info });
    let headers = [(HPRID_AUTH, manager_token)];
    let url = join(base_url, HFR_BASIC_PATH);
    let value = send(
        http,
        reqwest::Method::POST,
        &url,
        token,
        &headers,
        Some(&body),
    )
    .await?;
    Ok(StepOutcome::read(&value))
}

/// Save additional or detailed information: `body` is the step's object,
/// and the `trackingId` is added here.
///
/// # Errors
/// Any non-2xx or unreachable registry.
pub async fn hfr_save_step(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    (path, tracking_id): (&str, &str),
    body: &Value,
) -> Result<StepOutcome, AbdmError> {
    let mut body = body.clone();
    if let Some(obj) = body.as_object_mut() {
        obj.insert("trackingId".to_owned(), json!(tracking_id));
    }
    let value = post(http, &join(base_url, path), token, &body).await?;
    Ok(StepOutcome::read(&value))
}

/// Submit (or resubmit) the facility. `sourceOfInformation` and
/// `sourceUniqueID` are left empty (HFR-062/063): HFR then treats the
/// facility as a submitted entity.
///
/// # Errors
/// Any non-2xx or unreachable registry.
pub async fn hfr_submit(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    tracking_id: &str,
    (manager_token, verifier_token): (&str, &str),
) -> Result<SubmitOutcome, AbdmError> {
    let body = json!({ "trackingId": tracking_id, "sourceOfInformation": "",
                       "sourceUniqueID": "" });
    let headers = [
        (HPRID_AUTH, manager_token),
        (HPRID_AUTH_VERIFIER, verifier_token),
    ];
    let url = join(base_url, HFR_SUBMIT_PATH);
    let value = send(
        http,
        reqwest::Method::POST,
        &url,
        token,
        &headers,
        Some(&body),
    )
    .await?;
    Ok(SubmitOutcome::read(&value))
}

/// HPR's public key for the password, as base64 DER (PEM armour removed;
/// a JSON `{ publicKey }` answer is read too).
///
/// # Errors
/// Any non-2xx or unreachable registry.
pub async fn hpr_certificate(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
) -> Result<String, AbdmError> {
    let url = join(base_url, HPR_CERT_PATH);
    let text = send_text(http, reqwest::Method::GET, &url, token, &[], None).await?;
    Ok(read_certificate(&text))
}

/// The base64 key inside HPR's certificate answer.
#[must_use]
pub fn read_certificate(text: &str) -> String {
    let inner = serde_json::from_str::<Value>(text)
        .ok()
        .and_then(|v| {
            v.get("publicKey")
                .and_then(Value::as_str)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| text.to_owned());
    inner
        .lines()
        .filter(|l| !l.trim_start().starts_with("-----"))
        .flat_map(str::split_whitespace)
        .collect()
}

/// Sign a professional in to HPR. `encrypted_password` is already encrypted
/// under [`hpr_certificate`]. `Ok(None)`: HPR answered without a token.
///
/// # Errors
/// Any non-2xx (wrong password included) or unreachable registry.
pub async fn hpr_login(
    http: &reqwest::Client,
    base_url: &str,
    token: &str,
    hpr_id: &str,
    encrypted_password: &str,
) -> Result<Option<String>, AbdmError> {
    let body = json!({ "idType": "", "domainName": "", "hprId": hpr_id,
                       "password": encrypted_password });
    let value = post(http, &join(base_url, HPR_LOGIN_PATH), token, &body).await?;
    Ok(text(&value, "token").or_else(|| text(&value, "accessToken")))
}

/// An `errorStatus` entry: a string, or an object's `message`.
fn error_text(item: &Value) -> Option<String> {
    match item {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_owned()),
        Value::Object(_) => text(item, "message").or_else(|| Some(item.to_string())),
        _ => None,
    }
}

#[cfg(test)]
#[path = "hfr_onboarding_tests.rs"]
mod tests;
