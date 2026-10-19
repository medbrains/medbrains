//! Scan & Share for a patient registered before they had an ABHA: the desk
//! finds them by search and links the share, instead of registering a second
//! UHID for the same person.

mod abdm_hip_world;
mod common;

use abdm_hip_world::{
    World,
    scan_share::{body, counter, new_abha, post, rows, share},
    world,
};
use axum::http::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// Every test saves ABDM keys for the same hospital; run them one at a time.
static SERIAL: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// A patient registered here earlier; `abha` is a number typed at the time.
async fn existing_patient(w: &World, abha: Option<&str>) -> Uuid {
    let patient: Value = post(
        w,
        "/api/patients",
        &json!({
            "first_name": "Anil", "last_name": "Rao", "gender": "male",
            "date_of_birth": "1980-06-05",
            "phone": format!("9{:09}", Uuid::new_v4().as_u128() % 1_000_000_000),
            "abha_number": abha,
        }),
    )
    .await
    .json()
    .await
    .expect("patient");
    Uuid::parse_str(patient["id"].as_str().expect("id")).expect("uuid")
}

/// A new ABHA shared at a counter: the share's id and the ABHA number.
async fn new_share(w: &World) -> (Uuid, String) {
    let (_, code) = counter(w).await;
    let (number, address) = new_abha();
    let shared = body(&code, &number, &address);
    let status = share(w, &w.gateway_key, &Uuid::new_v4().to_string(), &shared).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    (rows(w, &address).await.pop().expect("share").id, number)
}

/// The share recorded as a verification, by whoever `client` is signed in as.
async fn verify(w: &World, client: &reqwest::Client, csrf: &str, share_id: Uuid) -> Uuid {
    let step: Value = client
        .post(
            w.app
                .url(&format!("/api/abdm/scan-share/{share_id}/verification")),
        )
        .header("x-csrf-token", csrf)
        .send()
        .await
        .expect("verification")
        .json()
        .await
        .expect("step");
    assert_eq!(step["stage"], "verified", "{step}");
    Uuid::parse_str(step["id"].as_str().expect("id")).expect("uuid")
}

async fn link(
    w: &World,
    client: &reqwest::Client,
    csrf: &str,
    (verification, patient): (Uuid, Uuid),
) -> reqwest::Response {
    client
        .post(
            w.app
                .url(&format!("/api/abdm/abha/verifications/{verification}/link")),
        )
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_id": patient, "apply": ["gender"] }))
        .send()
        .await
        .expect("link")
}

/// Given a patient registered before ABHA, and their new ABHA shared at the
/// counter, When the desk finds them, links the share and completes it, Then
/// the share is "linked" to that patient (no new UHID), the ABHA is verified
/// on them by Scan & Share, and the link is audited.
#[tokio::test]
async fn a_new_share_links_to_an_existing_patient_found_by_search() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let existing = existing_patient(&w, None).await;
    let (share_id, number) = new_share(&w).await;
    let verification = verify(&w, &w.app.client, &w.csrf, share_id).await;

    let linked = link(&w, &w.app.client, &w.csrf, (verification, existing)).await;
    assert_eq!(linked.status().as_u16(), 200);
    let done = post(
        &w,
        &format!("/api/abdm/scan-share/{share_id}/complete"),
        &json!({ "patient_id": existing }),
    )
    .await;
    assert_eq!(done.status().as_u16(), 200);

    let (status, patient): (String, Option<Uuid>) =
        sqlx::query_as("SELECT status, patient_id FROM abdm_profile_shares WHERE id = $1")
            .bind(share_id)
            .fetch_one(&w.app.db)
            .await
            .expect("share");
    assert_eq!((status.as_str(), patient), ("linked", Some(existing)));
    let (abha, method, verified): (Option<String>, Option<String>, bool) = sqlx::query_as(
        "SELECT abha_number, verification_method, verified_at IS NOT NULL \
           FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(existing)
    .fetch_one(&w.app.db)
    .await
    .expect("link");
    assert_eq!(abha.as_deref(), Some(number.as_str()));
    assert_eq!(method.as_deref(), Some("scan_share"));
    assert!(verified);
    let audited: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM audit_log WHERE action = 'patient.abha.linked' AND entity_id = $1",
    )
    .bind(existing)
    .fetch_one(&w.app.db)
    .await
    .expect("audit");
    assert_eq!(audited, 1);
}

/// Given the patient found already carries a different ABHA, When the desk
/// links the share to them, Then it is 409 with a reason, nothing is linked
/// and the share stays waiting for a decision.
#[tokio::test]
async fn a_patient_with_another_abha_is_refused() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let (other, _) = new_abha();
    let existing = existing_patient(&w, Some(&other)).await;
    let (share_id, _) = new_share(&w).await;
    let verification = verify(&w, &w.app.client, &w.csrf, share_id).await;

    let refused = link(&w, &w.app.client, &w.csrf, (verification, existing)).await;
    assert_eq!(refused.status().as_u16(), 409);
    let reason: Value = refused.json().await.expect("json");
    assert!(reason.to_string().contains("different ABHA"), "{reason}");
    let abha: Option<String> = sqlx::query_scalar(
        "SELECT abha_number FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(existing)
    .fetch_one(&w.app.db)
    .await
    .expect("link");
    assert_eq!(abha.as_deref(), Some(other.as_str()), "the old ABHA stays");
    let done = post(
        &w,
        &format!("/api/abdm/scan-share/{share_id}/complete"),
        &json!({ "patient_id": existing }),
    )
    .await;
    assert_eq!(done.status().as_u16(), 400);
}

/// Given desk staff with no relationship to the patient they picked, When
/// they link the share to them, Then it is refused as not found (existence
/// is not disclosed) and nothing is linked.
#[tokio::test]
async fn linking_needs_access_to_the_patient() {
    let _serial = SERIAL.lock().await;
    let w = world().await;
    let existing = existing_patient(&w, None).await;
    let (share_id, _) = new_share(&w).await;
    let desk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let verification = verify(&w, &desk.client, &desk.csrf, share_id).await;

    let refused = link(&w, &desk.client, &desk.csrf, (verification, existing)).await;
    let status = refused.status().as_u16();
    assert!(matches!(status, 403 | 404), "{status}");
    let links: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patient_abha_links WHERE patient_id = $1 AND deleted_at IS NULL",
    )
    .bind(existing)
    .fetch_one(&w.app.db)
    .await
    .expect("links");
    assert_eq!(links, 0);
}
