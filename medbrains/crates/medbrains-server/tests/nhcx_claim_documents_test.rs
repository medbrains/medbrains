//! An NHCX final claim carries its documents as PDFs, end to end against a
//! stand-in gateway and a stand-in Gotenberg.
//!
//! The desk prepares the documents — discharge summary, final bill and the
//! stay's released lab reports, each rendered through the print path — sees
//! their sizes, previews them, adds a stored document, and sends. The payer
//! receives each as `Claim.supportingInfo` with its NRCeS codes and the PDF
//! as `valueAttachment`. A file over the per-file cap is left out and said
//! so; with the PDF service down the claim is refused and nothing is queued.

use crate::nhcx_support;

use axum::http::StatusCode;
use base64::Engine;
use medbrains_core::nhcx::NhcxOperation;
use serde_json::{Value, json};
use uuid::Uuid;

use nhcx_support::Pdf;
use nhcx_support::claim_seed::{ClaimSeed, finalise_discharge_summary, seed_claim};
use nhcx_support::seed::{get_json, hospital_hfr_id, post, resources, seed_insured_patient};

/// The tests share one hospital's NHCX settings; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A discharged stay with a finalised summary and one released lab report.
async fn stay(n: &nhcx_support::Nhcx) -> (ClaimSeed, Uuid) {
    let (patient, policy, _) = seed_insured_patient(n).await;
    hospital_hfr_id(n).await;
    let seeded = seed_claim(n, patient, policy).await;
    finalise_discharge_summary(n, seeded.admission).await;
    let db = &n.app.db;
    let test: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_test_catalog (tenant_id, code, name, loinc_code) \
         VALUES ($1, $2, 'Haemoglobin', '718-7') RETURNING id",
    )
    .bind(n.tenant)
    .bind(format!("HB{}", n.tag.to_uppercase()))
    .fetch_one(db)
    .await
    .expect("lab test");
    let order: Uuid = sqlx::query_scalar(
        "INSERT INTO lab_orders (tenant_id, encounter_id, patient_id, test_id, ordered_by, \
             status, verified_at) \
         SELECT a.tenant_id, a.encounter_id, a.patient_id, $2, a.admitting_doctor, \
                'verified', now() \
           FROM admissions a WHERE a.id = $1 RETURNING id",
    )
    .bind(seeded.admission)
    .bind(test)
    .fetch_one(db)
    .await
    .expect("lab order");
    sqlx::query(
        "INSERT INTO lab_results (tenant_id, order_id, parameter_name, value, unit, flag) \
         VALUES ($1, $2, 'Haemoglobin', '10.2', 'g/dL', 'low')",
    )
    .bind(n.tenant)
    .bind(order)
    .execute(db)
    .await
    .expect("lab result");
    let stored: Uuid = sqlx::query_scalar(
        "INSERT INTO patient_documents (tenant_id, patient_id, document_type, document_name, \
             file_url, file_size, mime_type) \
         VALUES ($1, $2, 'referral', 'Referral letter', 'k/referral.pdf', 2048, \
             'application/pdf') RETURNING id",
    )
    .bind(n.tenant)
    .bind(patient)
    .fetch_one(db)
    .await
    .expect("stored document");
    (seeded, stored)
}

fn submit_path(claim: Uuid) -> String {
    format!("/api/billing/insurance-claims/{claim}/submit-to-nhcx")
}

/// The supportingInfo entries the payer received, by NRCeS category.
fn supporting_by_category<'a>(claim: &'a Value, category: &str) -> Vec<&'a Value> {
    claim["supportingInfo"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|i| i["category"]["coding"][0]["code"] == json!(category))
        .collect()
}

fn assert_pdf(info: &Value) {
    let att = &info["valueAttachment"];
    assert_eq!(att["contentType"], json!("application/pdf"));
    let data = att["data"].as_str().expect("data");
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .expect("base64");
    assert!(bytes.starts_with(b"%PDF"), "a PDF, not text");
    assert!(att["title"].is_string() && att["creation"].is_string());
}

#[tokio::test]
async fn the_desk_prepares_previews_and_sends_the_claims_documents_as_pdfs() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard().await;
    let (seeded, stored) = stay(&n).await;

    let resp = post(
        &n,
        &format!(
            "/api/billing/insurance-claims/{}/nhcx/documents",
            seeded.claim
        ),
        &json!({}),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let prepared: Value = resp.json().await.expect("json");
    let docs = prepared["documents"].as_array().expect("documents");
    let kinds: Vec<&str> = docs.iter().filter_map(|d| d["kind"].as_str()).collect();
    assert_eq!(kinds, ["discharge_summary", "final_bill", "lab_report"]);
    assert!(docs.iter().all(|d| d["size_bytes"].as_u64() > Some(0)));

    let summary_html = n
        .rendered
        .lock()
        .expect("lock")
        .iter()
        .find(|h| h.contains("DISCHARGE SUMMARY"))
        .cloned()
        .expect("the summary was printed");
    assert!(
        summary_html.contains("Acute appendicitis")
            && summary_html.contains("Laparoscopic appendicectomy"),
        "the PDF carries the finalised summary's diagnosis and course"
    );

    let lab_html = n
        .rendered
        .lock()
        .expect("lock")
        .iter()
        .find(|h| h.contains("lab-head"))
        .cloned()
        .expect("the lab report was printed");
    assert!(
        lab_html.contains("10.2"),
        "the lab report carries its result"
    );

    let preview = docs[0]["preview_url"].as_str().expect("preview");
    let pdf = n
        .app
        .client
        .get(n.app.url(preview))
        .send()
        .await
        .expect("preview");
    assert_eq!(pdf.status(), StatusCode::OK);
    assert!(pdf.bytes().await.expect("bytes").starts_with(b"%PDF"));

    let mut picks: Vec<Value> = docs
        .iter()
        .map(|d| json!({ "source": d["source"], "id": d["id"] }))
        .collect();
    picks.push(json!({ "source": "stored", "id": stored }));
    let resp = post(
        &n,
        &submit_path(seeded.claim),
        &json!({ "recipient_code": n.payer_code, "use": "claim", "documents": picks }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let queued: Value = resp.json().await.expect("json");
    assert_eq!(
        queued["attachments"]["attached"].as_array().map(Vec::len),
        Some(3)
    );
    let left = &queued["attachments"]["left_out"];
    assert_eq!(left[0]["title"], json!("Referral letter"));
    assert!(
        left[0]["reason"]
            .as_str()
            .is_some_and(|r| r.contains("storage")),
        "a stored file that cannot be read is reported, not dropped: {left}"
    );

    let correlation = queued["correlation_id"].as_str().expect("correlation");
    let (_, body) = n.send(NhcxOperation::Claim, correlation).await;
    let (_, bundle) = n.open_as_payer(&body);
    let claim = resources(&bundle, "Claim").next().expect("claim");
    for (category, code) in [("HDS", "DCR"), ("MB", "FB"), ("INV", "LIR")] {
        let found = supporting_by_category(claim, category);
        assert_eq!(found.len(), 1, "{category}");
        assert_eq!(found[0]["code"]["coding"][0]["code"], json!(code));
        assert_pdf(found[0]);
    }

    let view = get_json(
        &n,
        &format!("/api/billing/insurance-claims/{}/nhcx", seeded.claim),
    )
    .await;
    let attached = view["attachments"]["attached"]
        .as_array()
        .expect("attached");
    assert_eq!(attached.len(), 3, "the claim lists what was attached");
}

#[tokio::test]
async fn a_report_over_the_file_cap_is_left_out_and_reported() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard_with(Pdf::BigLabReports).await;
    let (seeded, _) = stay(&n).await;

    let resp = post(
        &n,
        &submit_path(seeded.claim),
        &json!({ "recipient_code": n.payer_code, "use": "claim" }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::OK);
    let queued: Value = resp.json().await.expect("json");
    let left = queued["attachments"]["left_out"]
        .as_array()
        .expect("left out");
    assert!(
        left.iter().any(|l| l["kind"] == json!("lab_report")
            && l["reason"]
                .as_str()
                .is_some_and(|r| r.contains("limit for one file"))),
        "the oversized report is named with its reason: {left:?}"
    );

    let correlation = queued["correlation_id"].as_str().expect("correlation");
    let (_, body) = n.send(NhcxOperation::Claim, correlation).await;
    let (_, bundle) = n.open_as_payer(&body);
    let claim = resources(&bundle, "Claim").next().expect("claim");
    assert_eq!(supporting_by_category(claim, "HDS").len(), 1);
    assert_eq!(supporting_by_category(claim, "MB").len(), 1);
    assert!(
        supporting_by_category(claim, "INV").is_empty(),
        "the big report stays out"
    );

    let view = get_json(
        &n,
        &format!("/api/billing/insurance-claims/{}/nhcx", seeded.claim),
    )
    .await;
    assert_eq!(
        view["attachments"]["left_out"],
        queued["attachments"]["left_out"]
    );
}

#[tokio::test]
async fn with_the_pdf_service_down_the_final_claim_is_refused_and_nothing_queued() {
    let _serial = SERIAL.lock().await;
    let n = nhcx_support::onboard_with(Pdf::Down).await;
    let (seeded, _) = stay(&n).await;

    let prepare = post(
        &n,
        &format!(
            "/api/billing/insurance-claims/{}/nhcx/documents",
            seeded.claim
        ),
        &json!({}),
    )
    .await;
    assert_eq!(prepare.status(), StatusCode::SERVICE_UNAVAILABLE);

    let resp = post(
        &n,
        &submit_path(seeded.claim),
        &json!({ "recipient_code": n.payer_code, "use": "claim" }),
    )
    .await;
    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let text = resp.text().await.unwrap_or_default();
    assert!(
        text.contains("discharge summary"),
        "says what could not go: {text}"
    );

    let (status, nhcx_status, queued): (String, Option<String>, i64) = sqlx::query_as(
        "SELECT c.status, c.nhcx_status, \
                (SELECT count(*) FROM outbox_events e \
                  WHERE e.payload->>'record_id' = c.id::text) \
           FROM insurance_claims c WHERE c.id = $1",
    )
    .bind(seeded.claim)
    .fetch_one(&n.app.db)
    .await
    .expect("claim");
    assert_eq!(status, "initiated", "the claim stays as it was");
    assert_eq!(nhcx_status, None);
    assert_eq!(queued, 0, "nothing went to the outbox");
}
