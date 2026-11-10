//! The registration desk's duplicate check against real rows: a returning
//! patient typed in another spelling is found as likely, a verified ABHA
//! number is the same person whatever the name, and the same name with
//! another birth date and mobile is not offered as a duplicate.

use chrono::NaiveDate;
use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;
use crate::delivery_choice_world::{Setup, setup, staff};

async fn patient(
    app: &common::TestApp,
    s: &Setup,
    (first, last): (&str, &str),
    dob: &str,
    phone: &str,
) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, date_of_birth, phone) \
         VALUES ($1, $2, $3, $4, 'female', $5, $6) RETURNING id",
    )
    .bind(s.tenant)
    .bind(format!("UH-MPI-{}", &Uuid::new_v4().simple().to_string()[..8]))
    .bind(first)
    .bind(last)
    .bind(NaiveDate::parse_from_str(dob, "%Y-%m-%d").ok())
    .bind(phone)
    .fetch_one(&app.db)
    .await
    .expect("patient")
}

fn phone() -> String {
    format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9])
}

fn find<'a>(matches: &'a Value, id: Uuid) -> Option<&'a Value> {
    matches.as_array()?.iter().find(|m| m["id"] == json!(id))
}

/// Given Smt. Lakshmi Venkatesan, female, born 12 Mar 1984, When the desk
/// registers "Laxmi Venkatesan" with that birth date and sex (no mobile
/// given), Then she is
/// offered as likely, with the spelling named as the reason — and an older
/// Lakshmi Venkatesan with another birth date and mobile is not offered.
#[tokio::test]
async fn a_returning_patient_in_another_spelling_is_found_as_likely() {
    let app = common::spawn_app().await;
    let s = setup(&app).await;
    let her = patient(
        &app,
        &s,
        ("Smt. Lakshmi", "Venkatesan"),
        "1984-03-12",
        &phone(),
    )
    .await;
    let other = patient(&app, &s, ("Lakshmi", "Venkatesan"), "1951-09-30", &phone()).await;
    let (status, matches) = staff(
        &app,
        &s,
        "POST",
        "/api/patients/match",
        json!({ "first_name": "Laxmi", "last_name": "Venkatesan",
                "date_of_birth": "1984-03-12", "gender": "female" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{matches}");
    let found = find(&matches, her).expect("she is found");
    assert_eq!(found["band"], "likely", "{found}");
    assert!(
        found["reasons"]
            .as_array()
            .is_some_and(|r| r.contains(&json!("Name matches in another spelling"))),
        "{found}"
    );
    assert!(find(&matches, other).is_none(), "{matches}");
}

/// Given a patient whose ABHA number was verified here, When the desk
/// enters that number (with or without dashes) under a different name,
/// Then that patient — and only that patient — is the same person.
#[tokio::test]
async fn a_verified_abha_number_is_the_same_person_whatever_the_name() {
    let app = common::spawn_app().await;
    let s = setup(&app).await;
    let digits = format!("91{}", &Uuid::new_v4().as_u128().to_string()[..12]);
    let id = patient(&app, &s, ("Revathi", "Sundaram"), "1979-05-01", &phone()).await;
    sqlx::query(
        "INSERT INTO patient_abha_links (tenant_id, patient_id, abha_number, kyc_verified, verified_at) \
         VALUES ($1, $2, $3, true, now())",
    )
    .bind(s.tenant)
    .bind(id)
    .bind(format!("{}-{}-{}-{}", &digits[..2], &digits[2..6], &digits[6..10], &digits[10..]))
    .execute(&app.db)
    .await
    .expect("abha link");
    let (status, matches) = staff(
        &app,
        &s,
        "POST",
        "/api/patients/match",
        json!({ "first_name": "R", "last_name": "S", "abha_number": digits }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{matches}");
    let rows = matches.as_array().cloned().unwrap_or_default();
    assert_eq!(rows.len(), 1, "{matches}");
    assert_eq!(rows[0]["id"], json!(id));
    assert_eq!(rows[0]["band"], "certain");
}
