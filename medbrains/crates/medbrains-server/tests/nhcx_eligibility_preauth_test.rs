//! NHCX eligibility and pre-authorisation, end to end against a stand-in
//! gateway.
//!
//! An eligibility check names the hospital by its HFR id and the patient by
//! their verified ABHA, and the payer's encrypted on_check reply reads back
//! as "in force" with its benefit lines. A pre-authorisation goes as a
//! ClaimBundle with `use = preauthorization` and the encounter's coded
//! diagnoses; the payer's question files a query, the desk's answer goes
//! back as an encrypted Communication, and the payer's decision lands with
//! its amount. The IRDAI clock flips after an hour (three at discharge), and
//! staff without the NHCX permissions are refused.

mod common;
mod nhcx_support;

use axum::http::StatusCode;
use medbrains_core::nhcx::NhcxOperation;
use medbrains_fhir::mapper::{ABHA_SYSTEM, HFR_SYSTEM, ICD10_SYSTEM, SNOMED_SYSTEM};
use serde_json::{Value, json};
use uuid::Uuid;

use nhcx_support::seed::{
    get_json, has_identifier, hospital_hfr_id, post, resources, seed_insured_patient, seed_preauth,
};

#[tokio::test]
async fn eligibility_names_the_hfr_campus_and_abha_and_the_answer_reads_as_in_force() {
    let n = nhcx_support::onboard().await;
    let (patient, _, abha) = seed_insured_patient(&n).await;
    let hfr = hospital_hfr_id(&n).await;

    let resp = post(
        &n,
        "/api/insurance/verifications/nhcx",
        &json!({ "patient_id": patient, "recipient_code": n.payer_code,
                 "trigger_point": "front_office", "service_categories": ["30", "3"] }),
    )
    .await;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let check: Value = resp.json().await.expect("json");
    assert_eq!(
        check["status"],
        json!("pending"),
        "waiting, never 'not covered'"
    );
    let correlation: String = sqlx::query_scalar(
        "SELECT nhcx_correlation_id::text FROM insurance_verifications WHERE id = $1::uuid",
    )
    .bind(check["id"].as_str().expect("id"))
    .fetch_one(&n.app.db)
    .await
    .expect("correlation");

    let (path, body) = n
        .send(NhcxOperation::CoverageEligibility, &correlation)
        .await;
    assert_eq!(path, "coverageeligibility/check");
    let (_, bundle) = n.open_as_payer(&body);
    let request = resources(&bundle, "CoverageEligibilityRequest")
        .next()
        .expect("request");
    assert_eq!(
        request["item"].as_array().map(Vec::len),
        Some(2),
        "both categories asked"
    );
    assert!(
        resources(&bundle, "Organization").any(|o| has_identifier(o, HFR_SYSTEM, &hfr)),
        "the provider is the HFR-registered campus"
    );
    let patient_res = resources(&bundle, "Patient").next().expect("patient");
    assert!(
        has_identifier(patient_res, ABHA_SYSTEM, &abha),
        "the verified ABHA goes"
    );
    let coverage = resources(&bundle, "Coverage").next().expect("coverage");
    assert_eq!(coverage["subscriberId"], json!("MEM-1"));

    let answer = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "CoverageEligibilityResponse", "outcome": "complete",
        "insurance": [{
            "inforce": true,
            "benefitPeriod": { "start": "2026-04-01", "end": "2027-03-31" },
            "item": [{ "name": "Hospitalisation", "benefit": [{
                "type": { "text": "benefit" },
                "allowedMoney": { "value": 500000, "currency": "INR" },
                "usedMoney": { "value": 120000, "currency": "INR" }
            }]}]
        }]
    }}]});
    let status = n
        .callback("coverageeligibility/on_check", &correlation, &answer)
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);

    let checks = get_json(
        &n,
        &format!("/api/insurance/nhcx/eligibility?patient_id={patient}"),
    )
    .await;
    let latest = &checks[0];
    assert_eq!(latest["status"], json!("active"));
    assert_eq!(latest["coverage_end"], json!("2027-03-31"));
    assert_eq!(latest["nhcx_result"]["in_force"], json!(true));
    assert_eq!(
        latest["nhcx_result"]["benefits"][0]["allowed"],
        json!(500_000)
    );
    assert_eq!(latest["nhcx_result"]["benefits"][0]["used"], json!(120_000));
}

#[tokio::test]
async fn a_preauth_goes_with_diagnoses_a_payer_query_is_answered_and_the_decision_lands() {
    let n = nhcx_support::onboard().await;
    let (patient, policy, _) = seed_insured_patient(&n).await;
    let (pa, doc) = seed_preauth(&n, patient, policy).await;

    let resp = post(
        &n,
        &format!("/api/insurance/prior-auths/{pa}/submit-to-nhcx"),
        &json!({ "recipient_code": n.payer_code, "request_stage": "initial" }),
    )
    .await;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let queued: Value = resp.json().await.expect("json");
    let correlation = queued["correlation_id"]
        .as_str()
        .expect("correlation")
        .to_owned();

    let (path, body) = n.send(NhcxOperation::Preauth, &correlation).await;
    assert_eq!(path, "preauth/submit");
    let (headers, bundle) = n.open_as_payer(&body);
    assert_eq!(headers["x-hcx-correlation_id"], json!(correlation));
    let claim = resources(&bundle, "Claim").next().expect("claim");
    assert_eq!(claim["use"], json!("preauthorization"));
    let coding = &claim["diagnosis"][0]["diagnosisCodeableConcept"]["coding"];
    assert_eq!(
        coding[0],
        json!({ "system": ICD10_SYSTEM, "code": "K35.80", "display": "Acute appendicitis" })
    );
    assert_eq!(coding[1]["system"], json!(SNOMED_SYSTEM));
    assert_eq!(
        claim["supportingInfo"][0]["valueAttachment"]["title"],
        json!("ct-abdomen.pdf")
    );
    assert_eq!(claim["total"]["value"], json!(50000.0));

    // The payer asks for more.
    let question = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "CommunicationRequest",
        "payload": [{ "contentString": "Send the CT report." }],
        "reasonCode": [{ "text": "Investigation reports" }]
    }}]});
    let status = n
        .callback("communication/request", &correlation, &question)
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["status"], json!("pending_info"));
    let query = &view["queries"][0];
    assert_eq!(query["question"], json!("Send the CT report."));
    assert_eq!(query["status"], json!("open"));
    assert!(
        view["timeline"]
            .as_array()
            .expect("timeline")
            .iter()
            .any(|e| e["kind"] == "query_raised"),
        "the timeline shows the query"
    );

    // The desk answers with the CT report attached.
    let query_id = query["id"].as_str().expect("query id");
    let resp = post(
        &n,
        &format!("/api/insurance/nhcx/queries/{query_id}/answer"),
        &json!({ "text": "CT report attached.", "document_ids": [doc] }),
    )
    .await;
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let (path, body) = n.send(NhcxOperation::Communication, &correlation).await;
    assert_eq!(path, "communication/on_request");
    let (headers, communication) = n.open_as_payer(&body);
    assert_eq!(headers["x-hcx-correlation_id"], json!(correlation));
    assert_eq!(headers["x-hcx-status"], json!("response.complete"));
    assert_eq!(communication["resourceType"], json!("Communication"));
    assert_eq!(
        communication["payload"][0]["contentString"],
        json!("CT report attached.")
    );
    assert_eq!(
        communication["payload"][1]["contentAttachment"]["title"],
        json!("ct-abdomen.pdf")
    );
    let again = post(
        &n,
        &format!("/api/insurance/nhcx/queries/{query_id}/answer"),
        &json!({ "text": "Twice" }),
    )
    .await;
    assert_eq!(again.status(), StatusCode::CONFLICT, "answered once");

    // The payer decides: 40,000 of the 50,000 asked.
    let decision = json!({ "resourceType": "Bundle", "entry": [{ "resource": {
        "resourceType": "ClaimResponse", "outcome": "complete", "preAuthRef": "AUTH-9",
        "total": [{ "category": { "coding": [{ "code": "benefit" }] }, "amount": { "value": 40000 } }]
    }}]});
    let status = n
        .callback("preauth/on_submit", &correlation, &decision)
        .await;
    assert_eq!(status, StatusCode::ACCEPTED);
    let view = get_json(&n, &format!("/api/insurance/prior-auths/{pa}/nhcx")).await;
    assert_eq!(view["status"], json!("partially_approved"));
    assert_eq!(view["approved_amount"], json!("40000"));
    assert_eq!(view["auth_number"], json!("AUTH-9"));
    assert_eq!(view["sla"]["state"], json!("met"));
}

#[tokio::test]
async fn the_irdai_clock_breaches_after_one_hour_and_after_three_at_discharge() {
    let n = nhcx_support::onboard().await;
    let (patient, policy, _) = seed_insured_patient(&n).await;
    let mut ids = Vec::new();
    for (i, (stage, minutes_ago)) in [("initial", 30), ("initial", 61), ("discharge", 61)]
        .into_iter()
        .enumerate()
    {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO prior_auth_requests (tenant_id, pa_number, patient_id, \
                 patient_insurance_id, service_type, status, request_stage, nhcx_recipient_code, \
                 submitted_at, nhcx_submitted_at) \
             VALUES ($1, $2, $3, $4, 'surgery', 'submitted', $5, $6, \
                     now() - make_interval(mins => $7), now() - make_interval(mins => $7)) \
             RETURNING id",
        )
        .bind(n.tenant)
        .bind(format!("PA-SLA-{}-{i}", n.tag))
        .bind(patient)
        .bind(policy)
        .bind(stage)
        .bind(&n.payer_code)
        .bind(minutes_ago)
        .fetch_one(&n.app.db)
        .await
        .expect("prior auth");
        ids.push(id);
    }

    let report = get_json(&n, &format!("/api/insurance/nhcx/sla?patient_id={patient}")).await;
    let state_of = |id: Uuid| {
        report["rows"]
            .as_array()
            .expect("rows")
            .iter()
            .find(|r| r["prior_auth_id"] == json!(id))
            .map(|r| r["sla"]["state"].clone())
    };
    assert_eq!(state_of(ids[0]), Some(json!("running")), "30 min of 1 h");
    assert_eq!(state_of(ids[1]), Some(json!("breached")), "61 min of 1 h");
    assert_eq!(
        state_of(ids[2]),
        Some(json!("running")),
        "61 min of 3 h at discharge"
    );
    let payer = report["by_payer"]
        .as_array()
        .expect("by payer")
        .iter()
        .find(|p| p["payer_code"] == json!(n.payer_code))
        .expect("the payer");
    assert_eq!(payer["breached"], json!(1));
    assert_eq!(payer["payer_name"], json!("Mock Payer"));
}

#[tokio::test]
async fn staff_without_the_nhcx_permissions_are_refused() {
    let n = nhcx_support::onboard().await;
    let (patient, _, _) = seed_insured_patient(&n).await;
    let clerk = common::provision_staff(
        &n.app,
        &n.csrf,
        "billing_clerk",
        &[
            "insurance.nhcx.submit",
            "insurance.nhcx.view",
            "insurance.nhcx.respond",
        ],
    )
    .await;
    let as_clerk = |method: reqwest::Method, path: String| {
        clerk
            .client
            .request(method, n.app.url(&path))
            .header("x-csrf-token", &clerk.csrf)
    };
    let attempts = [
        as_clerk(
            reqwest::Method::POST,
            "/api/insurance/verifications/nhcx".into(),
        )
        .json(&json!({ "patient_id": patient, "recipient_code": n.payer_code })),
        as_clerk(
            reqwest::Method::GET,
            format!("/api/insurance/nhcx/eligibility?patient_id={patient}"),
        ),
        as_clerk(reqwest::Method::GET, "/api/insurance/nhcx/sla".into()),
        as_clerk(
            reqwest::Method::GET,
            format!("/api/insurance/prior-auths/{}/nhcx", Uuid::new_v4()),
        ),
        as_clerk(
            reqwest::Method::POST,
            format!(
                "/api/insurance/prior-auths/{}/submit-to-nhcx",
                Uuid::new_v4()
            ),
        )
        .json(&json!({ "recipient_code": n.payer_code })),
        as_clerk(
            reqwest::Method::POST,
            format!("/api/insurance/nhcx/queries/{}/answer", Uuid::new_v4()),
        )
        .json(&json!({ "text": "x" })),
    ];
    for attempt in attempts {
        let resp = attempt.send().await.expect("request");
        assert_eq!(resp.status(), StatusCode::FORBIDDEN, "{}", resp.url());
    }
    let queued: i64 =
        sqlx::query_scalar("SELECT count(*) FROM insurance_verifications WHERE patient_id = $1")
            .bind(patient)
            .fetch_one(&n.app.db)
            .await
            .expect("count");
    assert_eq!(queued, 0, "nothing was sent");
}
