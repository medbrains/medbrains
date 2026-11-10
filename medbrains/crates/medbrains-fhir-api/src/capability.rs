//! `GET /api/fhir/metadata` — the CapabilityStatement, public as FHIR clients
//! expect (it describes the server and holds no patient data).
//!
//! It says what this server does, and only that: read (and Patient
//! `$everything`, Composition search by encounter) on five resource types,
//! JSON, bearer-token security — not SMART on FHIR. `implementationGuide` is
//! the NRCeS IG release the HIP bundles follow; `supportedProfile` is listed
//! only where the read API's resource carries that profile.

use axum::Json;
use axum::http::HeaderMap;
use axum::http::header::HOST;
use medbrains_fhir::nrces::{NRCES_IG_CANONICAL, NRCES_IG_VERSION, NRCES_PROFILE_BASE};
use serde_json::{Value, json};

/// When these capabilities last changed. Fixed, not the time of the call: a
/// client caches the statement and compares dates.
pub const CAPABILITY_DATE: &str = "2026-10-26";

const FHIR_PATH: &str = "/api/fhir";

/// The statement, for a server reachable at `base` (`https://host/api/fhir`).
#[must_use]
pub fn capability_statement(base: Option<&str>) -> Value {
    let read = json!([{ "code": "read" }]);
    let mut implementation = json!({ "description": "MedBrains FHIR R4 read API" });
    if let Some(url) = base {
        implementation["url"] = json!(url);
    }
    json!({
        "resourceType": "CapabilityStatement",
        "id": "medbrains",
        "url": "https://medbrains.health/fhir/CapabilityStatement/medbrains",
        "version": env!("CARGO_PKG_VERSION"),
        "name": "MedBrainsFhirServer",
        "title": "MedBrains FHIR R4 server",
        "status": "active",
        "experimental": false,
        "date": CAPABILITY_DATE,
        "publisher": "MedBrains",
        "description": "Read access to patient records for ABDM and EHR exchange clients.",
        "kind": "instance",
        "software": { "name": "MedBrains", "version": env!("CARGO_PKG_VERSION") },
        "implementation": implementation,
        "fhirVersion": "4.0.1",
        "format": ["application/fhir+json", "json"],
        "implementationGuide": [format!("{NRCES_IG_CANONICAL}|{NRCES_IG_VERSION}")],
        "rest": [{
            "mode": "server",
            "security": {
                "description": "Every call except this one needs an `Authorization: Bearer` header carrying a MedBrains sign-in token or an API key. Access follows the caller's permissions and their access to the patient. SMART on FHIR is not offered."
            },
            "resource": [
                {
                    "type": "Patient",
                    "supportedProfile": [format!("{NRCES_PROFILE_BASE}Patient")],
                    "interaction": read,
                    "operation": [{
                        "name": "everything",
                        "definition": "http://hl7.org/fhir/OperationDefinition/Patient-everything"
                    }]
                },
                { "type": "Encounter", "interaction": read },
                {
                    "type": "Composition",
                    "interaction": [{ "code": "read" }, { "code": "search-type" }],
                    "searchParam": [{
                        "name": "encounter",
                        "definition": "http://hl7.org/fhir/SearchParameter/Composition-encounter",
                        "type": "reference"
                    }]
                },
                { "type": "Observation", "interaction": read },
                { "type": "DiagnosticReport", "interaction": read }
            ]
        }]
    })
}

/// This server's FHIR base, from the request: behind the proxy the scheme is
/// in `X-Forwarded-Proto`. Echoed only to the caller who sent the header.
fn base_url(headers: &HeaderMap) -> Option<String> {
    let host = headers.get(HOST)?.to_str().ok()?;
    let scheme = headers
        .get("x-forwarded-proto")
        .and_then(|v| v.to_str().ok())
        .filter(|s| matches!(*s, "http" | "https"))
        .unwrap_or("https");
    Some(format!("{scheme}://{host}{FHIR_PATH}"))
}

/// `GET /api/fhir/metadata` — public.
pub async fn metadata(headers: HeaderMap) -> Json<Value> {
    Json(capability_statement(base_url(&headers).as_deref()))
}

#[cfg(test)]
mod tests {
    use super::{CAPABILITY_DATE, capability_statement};

    /// Given two calls a day apart, Then the statement is the same: its date
    /// is when the capabilities changed, not now. With `NRCES_BUNDLE_DIR` set
    /// it is written there for the HL7 validator run.
    #[test]
    fn the_statement_names_its_ig_profiles_and_operation_canonically() {
        let c = capability_statement(Some("https://hospital.example/api/fhir"));
        assert_eq!(c["date"], CAPABILITY_DATE);
        assert_eq!(
            c,
            capability_statement(Some("https://hospital.example/api/fhir"))
        );
        assert_eq!(
            c["implementationGuide"][0],
            "https://nrces.in/ndhm/fhir/r4/ImplementationGuide/ndhm.in|6.5.0"
        );
        let patient = &c["rest"][0]["resource"][0];
        assert_eq!(
            patient["operation"][0]["definition"],
            "http://hl7.org/fhir/OperationDefinition/Patient-everything"
        );
        assert_eq!(
            patient["supportedProfile"][0],
            "https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"
        );
        assert!(
            c["rest"][0]["security"]["description"]
                .as_str()
                .is_some_and(|d| d.contains("not offered"))
        );
        assert_eq!(
            c["implementation"]["url"],
            "https://hospital.example/api/fhir"
        );
        assert!(
            capability_statement(None)["implementation"]
                .get("url")
                .is_none()
        );
        if let Ok(dir) = std::env::var("NRCES_BUNDLE_DIR") {
            let body = serde_json::to_vec_pretty(&c).unwrap_or_default();
            assert!(std::fs::write(format!("{dir}/capability-statement.json"), body).is_ok());
        }
    }
}
