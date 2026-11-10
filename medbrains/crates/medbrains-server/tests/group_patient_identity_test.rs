//! One person across a hospital group: linked, never merged. A verified
//! ABHA at two hospitals links at once; a spelling variant with the same
//! birth date waits for a person to decide; nothing links in a group that
//! has not declared that its hospitals share records; an unlink needs a
//! reason and leaves both records as they were.

use chrono::NaiveDate;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;
use crate::delivery_choice_world::{Setup, setup, staff};

async fn tenant(app: &common::TestApp) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO tenants (code, name, hospital_type) VALUES ($1, 'Sunrise East', 'multi_specialty') \
         RETURNING id",
    )
    .bind(format!("GRP{}", Uuid::new_v4().simple().to_string()[..8].to_uppercase()))
    .fetch_one(&app.db)
    .await
    .expect("tenant")
}

async fn group(app: &common::TestApp, s: &Setup, other: Uuid, shares: bool) -> Uuid {
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO hospital_groups (code, name, share_clinical_records) \
         VALUES ($1, 'Sunrise Hospitals', $2) RETURNING id",
    )
    .bind(format!("G{}", Uuid::new_v4().simple().to_string()[..8].to_uppercase()))
    .bind(shares)
    .fetch_one(&app.db)
    .await
    .expect("group");
    sqlx::query("UPDATE tenants SET group_id = $1 WHERE id = ANY($2)")
        .bind(id)
        .bind(vec![s.tenant, other])
        .execute(&app.db)
        .await
        .expect("join group");
    id
}

async fn leave_group(app: &common::TestApp, s: &Setup) {
    sqlx::query("UPDATE tenants SET group_id = NULL WHERE id = $1")
        .bind(s.tenant)
        .execute(&app.db)
        .await
        .expect("leave group");
}

async fn patient(
    app: &common::TestApp,
    tenant: Uuid,
    (first, last): (&str, &str),
    dob: &str,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, date_of_birth, phone) \
         VALUES ($1, $2, $3, $4, 'female', $5, '') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-G-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(first)
    .bind(last)
    .bind(NaiveDate::parse_from_str(dob, "%Y-%m-%d").ok())
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

async fn verified_abha(app: &common::TestApp, tenant: Uuid, patient: Uuid, number: &str) {
    sqlx::query(
        "INSERT INTO patient_abha_links (tenant_id, patient_id, abha_number, kyc_verified, verified_at) \
         VALUES ($1, $2, $3, true, now())",
    )
    .bind(tenant)
    .bind(patient)
    .bind(number)
    .execute(&app.db)
    .await
    .expect("abha");
}

fn ids(rows: &Value, key: &str) -> Vec<Value> {
    rows[key]
        .as_array()
        .into_iter()
        .flatten()
        .map(|r| r["id"].clone())
        .collect()
}

/// Given Sunrise Hospitals sharing records, Meenakshi Sundaram registered at
/// both hospitals with the same verified ABHA, and "Minakshi Sundaram" with
/// her birth date at the other, When MRD scans from here, Then the ABHA
/// record is linked at once and the spelling variant waits for review;
/// linking it from the queue shows both, and unlinking needs a reason.
#[tokio::test]
async fn certain_matches_link_and_probable_ones_wait_for_a_person() {
    let app = common::spawn_app().await;
    let s = setup(&app).await;
    let east = tenant(&app).await;
    group(&app, &s, east, true).await;
    let digits = format!("91{}", &Uuid::new_v4().as_u128().to_string()[..12]);
    let here = patient(&app, s.tenant, ("Meenakshi", "Sundaram"), "1971-02-14").await;
    let there = patient(&app, east, ("Meenakshi", "Sundaram"), "1971-02-14").await;
    let variant = patient(&app, east, ("Minakshi", "Sundaram"), "1971-02-14").await;
    verified_abha(&app, s.tenant, here, &digits).await;
    verified_abha(&app, east, there, &digits).await;

    let path = format!("/api/patients/{here}/group-identity");
    let (status, scan) = staff(&app, &s, "POST", &format!("{path}/scan"), json!({})).await;
    assert_eq!(status, StatusCode::OK, "{scan}");
    assert_eq!(scan["linked"], 1, "{scan}");
    let (_, view) = staff(&app, &s, "GET", &path, Value::Null).await;
    assert_eq!(ids(&view, "links"), vec![json!(there)], "{view}");
    assert_eq!(view["links"][0]["match_method"], "abha");
    let pending = view["candidates"].as_array().cloned().unwrap_or_default();
    let candidate = pending
        .iter()
        .find(|c| c["id"] == json!(variant))
        .expect("the spelling variant waits for review");
    assert_eq!(candidate["hospital"], "Sunrise East");

    let decide = format!(
        "/api/patients/group-identity/candidates/{}/decide",
        candidate["candidate_id"].as_str().unwrap_or_default()
    );
    let (status, _) = staff(&app, &s, "POST", &decide, json!({ "decision": "link" })).await;
    assert_eq!(status, StatusCode::OK);
    let (_, view) = staff(&app, &s, "GET", &path, Value::Null).await;
    let mut linked = ids(&view, "links");
    linked.sort_by_key(ToString::to_string);
    let mut expected = vec![json!(there), json!(variant)];
    expected.sort_by_key(ToString::to_string);
    assert_eq!(linked, expected, "{view}");

    let link_id = view["links"][0]["link_id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let unlink = format!("/api/patients/group-identity/links/{link_id}/unlink");
    let (status, _) = staff(&app, &s, "POST", &unlink, json!({ "reason": "no" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST, "a reason is required");
    let (status, _) = staff(
        &app,
        &s,
        "POST",
        &unlink,
        json!({ "reason": "different husband" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    leave_group(&app, &s).await;
}

/// Given a group whose management has not turned on record sharing, When
/// MRD scans, Then nothing is searched or linked, and the reason is said.
#[tokio::test]
async fn nothing_links_in_a_group_that_does_not_share_records() {
    let app = common::spawn_app().await;
    let s = setup(&app).await;
    let east = tenant(&app).await;
    group(&app, &s, east, false).await;
    let here = patient(&app, s.tenant, ("Revathi", "Kannan"), "1980-06-01").await;
    let (status, body) = staff(
        &app,
        &s,
        "POST",
        &format!("/api/patients/{here}/group-identity/scan"),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::CONFLICT, "{body}");
    let (_, view) = staff(
        &app,
        &s,
        "GET",
        &format!("/api/patients/{here}/group-identity"),
        Value::Null,
    )
    .await;
    assert_eq!(view["sharing"], false, "{view}");
    leave_group(&app, &s).await;
}
