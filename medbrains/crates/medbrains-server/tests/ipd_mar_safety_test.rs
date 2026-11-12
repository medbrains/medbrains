//! The medication record's administration gate (IPSG.3).
//!
//! A high-alert dose — insulin, heparin, potassium — is given only after an
//! independent double check by a second qualified clinician and a wristband
//! and drug scan. A dose recorded as given never changes. A dose held,
//! refused or missed carries the reason the prescriber will read. Each refusal
//! here must leave the dose exactly as it was.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// An admitted patient with the admin session that admitted them.
struct Ward {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    patient: Value,
    admission: Uuid,
}

/// Admit a fresh patient, without a bed; MAR needs only the admission.
async fn admit() -> R<Ward> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let doctor = common::provision_staff(&app, &csrf, "doctor", &[]).await;
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await?;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "first_name": "Mar", "last_name": "Gate", "gender": "female",
                       "date_of_birth": "1959-09-09", "phone": "9990000082" }),
        )
        .send()
        .await?
        .json()
        .await?;
    let created: Value = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "patient_id": patient["id"], "department_id": depts[0]["id"],
                       "doctor_id": doctor.user_id }),
        )
        .send()
        .await?
        .json()
        .await?;
    let admission = created["admission"]["id"]
        .as_str()
        .ok_or("admission id")?
        .parse()?;
    Ok(Ward {
        app,
        csrf,
        tenant,
        patient,
        admission,
    })
}

impl Ward {
    /// Send `body` to `path` as the admin; returns the status and JSON body.
    async fn send(&self, method: Method, path: &str, body: &Value) -> R<(StatusCode, Value)> {
        let resp = self
            .app
            .client
            .request(method, self.app.url(path))
            .header("x-csrf-token", &self.csrf)
            .json(body)
            .send()
            .await?;
        let status = resp.status();
        Ok((status, resp.json().await.unwrap_or(Value::Null)))
    }

    /// Schedule a dose on this admission; returns its id.
    async fn new_dose(&self, drug: &str, high_alert: bool) -> R<Uuid> {
        let path = format!("/api/ipd/admissions/{}/mar", self.admission);
        let body = json!({ "drug_name": drug, "dose": "10 units", "route": "sc",
                           "frequency": "OD", "scheduled_at": "2026-11-12T08:00:00Z",
                           "is_high_alert": high_alert });
        let (status, dose) = self.send(Method::POST, &path, &body).await?;
        assert_eq!(status, StatusCode::OK, "{dose}");
        Ok(dose["id"].as_str().ok_or("dose id")?.parse()?)
    }

    /// Record a status change on `dose` through the admission's MAR route.
    async fn mark(&self, dose: Uuid, body: &Value) -> R<StatusCode> {
        let path = format!("/api/ipd/admissions/{}/mar/{dose}", self.admission);
        Ok(self.send(Method::PUT, &path, body).await?.0)
    }

    /// The dose's status, giver and witness, read from the table.
    async fn dose_row(&self, dose: Uuid) -> R<(String, Option<Uuid>, Option<Uuid>)> {
        Ok(sqlx::query_as(
            "SELECT status::text, administered_by, witnessed_by \
               FROM ipd_medication_administration WHERE id = $1",
        )
        .bind(dose)
        .fetch_one(&self.app.db)
        .await?)
    }
}

/// Given a high-alert dose, When it is marked given with no witness, or with a
/// nurse but no scan (even with the client claiming the scan), Then it is
/// refused; When it has been scanned, Then the giver as witness, an unknown
/// user, a receptionist, and a nurse with `nurse.mar.witness` denied are each
/// refused and the dose stays scheduled; When
/// a nurse witnesses, Then it is given by the admin and witnessed by the nurse,
/// and cannot be given or held afterwards.
#[tokio::test]
async fn a_high_alert_dose_needs_a_qualified_witness_and_a_scan() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Insulin regular", true).await?;
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&w.app.db)
        .await?;
    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let clerk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let barred = common::provision_staff(&w.app, &w.csrf, "nurse", &["nurse.mar.witness"]).await;

    let refused = [
        json!({ "status": "given" }),
        json!({ "status": "given", "witnessed_by": nurse.user_id }),
        json!({ "status": "given", "witnessed_by": nurse.user_id, "barcode_verified": true }),
    ];
    for body in &refused {
        assert_eq!(w.mark(dose, body).await?, StatusCode::BAD_REQUEST, "{body}");
        assert_eq!(
            w.dose_row(dose).await?,
            ("scheduled".to_owned(), None, None),
            "{body}"
        );
    }

    // The scan itself is proved below; here it is taken as done.
    sqlx::query("UPDATE ipd_medication_administration SET barcode_verified = true WHERE id = $1")
        .bind(dose)
        .execute(&w.app.db)
        .await?;
    // Scanned, so only the witness can be what refuses these.
    let unqualified = [admin, Uuid::new_v4(), clerk.user_id, barred.user_id];
    for witness in unqualified {
        let body = json!({ "status": "given", "witnessed_by": witness });
        assert_eq!(
            w.mark(dose, &body).await?,
            StatusCode::BAD_REQUEST,
            "{body}"
        );
        assert_eq!(
            w.dose_row(dose).await?,
            ("scheduled".to_owned(), None, None)
        );
    }
    let given = json!({ "status": "given", "witnessed_by": nurse.user_id });
    assert_eq!(w.mark(dose, &given).await?, StatusCode::OK);
    let expected = ("given".to_owned(), Some(admin), Some(nurse.user_id));
    assert_eq!(w.dose_row(dose).await?, expected);

    assert_eq!(
        w.mark(dose, &given).await?,
        StatusCode::CONFLICT,
        "given is final"
    );
    let undo = json!({ "status": "held", "hold_reason": "Changed my mind" });
    assert_eq!(w.mark(dose, &undo).await?, StatusCode::CONFLICT);
    assert_eq!(w.dose_row(dose).await?, expected);
    Ok(())
}

/// Given a scheduled dose, When the wristband scanned is not this patient's,
/// or the patient's band is scanned against a drug that resolves to no order,
/// Then the scan is not verified and says which right failed, and the dose is
/// not marked verified.
#[tokio::test]
async fn a_scan_of_the_wrong_patient_or_drug_does_not_verify_the_dose() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Heparin", true).await?;
    let path = format!("/api/nurse/mar/{dose}/verify-barcode");
    let uhid = w.patient["uhid"].as_str().ok_or("uhid")?;

    let wrong_patient = json!({ "patient_barcode": "NOT-THIS-PATIENT", "drug_barcode": "X" });
    let (status, scan) = w.send(Method::POST, &path, &wrong_patient).await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        (scan["verified"].as_bool(), scan["right_patient"].as_bool()),
        (Some(false), Some(false))
    );

    let wrong_drug = json!({ "patient_barcode": uhid.to_lowercase(), "drug_barcode": "NO-SUCH" });
    let (_, scan) = w.send(Method::POST, &path, &wrong_drug).await?;
    assert_eq!(
        scan["right_patient"].as_bool(),
        Some(true),
        "wristband match ignores case"
    );
    assert_eq!(
        (scan["verified"].as_bool(), scan["right_drug"].as_bool()),
        (Some(false), Some(false))
    );
    assert!(
        scan["reason"]
            .as_str()
            .is_some_and(|r| r.starts_with("Wrong drug")),
        "{scan}"
    );

    let verified: bool = sqlx::query_scalar(
        "SELECT barcode_verified FROM ipd_medication_administration WHERE id = $1",
    )
    .bind(dose)
    .fetch_one(&w.app.db)
    .await?;
    assert!(!verified, "a failed scan must not unlock the dose");
    Ok(())
}

/// Given a scheduled dose, When it is held, refused or missed with no reason
/// (or only spaces), Then each is refused 400; When held with a reason, Then
/// the reason is recorded and nobody is recorded as having given it.
#[tokio::test]
async fn a_dose_not_given_carries_its_reason() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Metformin", false).await?;
    let blank = [
        json!({ "status": "held" }),
        json!({ "status": "held", "hold_reason": "   " }),
        json!({ "status": "refused" }),
        json!({ "status": "missed", "missed_reason": "" }),
        json!({ "status": "lost" }),
    ];
    for body in &blank {
        assert_eq!(w.mark(dose, body).await?, StatusCode::BAD_REQUEST, "{body}");
    }
    let held = json!({ "status": "held", "hold_reason": "Nil by mouth for surgery" });
    assert_eq!(w.mark(dose, &held).await?, StatusCode::OK);
    let (status, by, _) = w.dose_row(dose).await?;
    assert_eq!((status.as_str(), by), ("held", None));
    let reason: Option<String> =
        sqlx::query_scalar("SELECT hold_reason FROM ipd_medication_administration WHERE id = $1")
            .bind(dose)
            .fetch_one(&w.app.db)
            .await?;
    assert_eq!(reason.as_deref(), Some("Nil by mouth for surgery"));
    Ok(())
}

/// Given a nurse on the care team whose role grant has `nurse.mar.hold`
/// denied, When she holds a dose, Then 403 and the dose is still scheduled;
/// And a dose addressed under another admission's URL answers 404.
#[tokio::test]
async fn holding_needs_its_own_permission_and_the_right_admission() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Amlodipine", false).await?;
    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &["nurse.mar.hold"]).await;
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'admission', $2, 'viewer', 'user', $3::text, $3)",
    )
    .bind(w.tenant)
    .bind(w.admission)
    .bind(nurse.user_id)
    .execute(&w.app.db)
    .await?;
    let path = format!("/api/ipd/admissions/{}/mar/{dose}", w.admission);
    let held = json!({ "status": "held", "hold_reason": "BP 90/60" });
    let resp = nurse
        .client
        .put(w.app.url(&path))
        .header("x-csrf-token", &nurse.csrf)
        .json(&held)
        .send()
        .await?;
    assert_eq!(resp.status(), StatusCode::FORBIDDEN);
    assert_eq!(w.dose_row(dose).await?.0, "scheduled");

    let elsewhere = format!("/api/ipd/admissions/{}/mar/{dose}", Uuid::new_v4());
    assert_eq!(
        w.send(Method::PUT, &elsewhere, &held).await?.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(w.dose_row(dose).await?.0, "scheduled");
    Ok(())
}

/// Given a member of an "ICU nurse" access group that grants `nurse.mar.witness`,
/// whose own role does not, When she witnesses a scanned high-alert dose, Then
/// it is given: the witness's resolved grant decides, not her role's name.
#[tokio::test]
async fn an_access_group_grant_makes_a_witness() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Potassium chloride", true).await?;
    let member = common::provision_staff(&w.app, &w.csrf, "staff", &[]).await;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let group: Uuid = sqlx::query_scalar(
        "INSERT INTO access_groups (tenant_id, code, name, permissions) \
         VALUES ($1, $2, 'ICU nurse', '[\"nurse.mar.witness\"]'::jsonb) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("icu_nurse_{tag}"))
    .fetch_one(&w.app.db)
    .await?;
    sqlx::query(
        "INSERT INTO access_group_members (group_id, user_id, tenant_id) VALUES ($1, $2, $3)",
    )
    .bind(group)
    .bind(member.user_id)
    .bind(w.tenant)
    .execute(&w.app.db)
    .await?;
    sqlx::query("UPDATE ipd_medication_administration SET barcode_verified = true WHERE id = $1")
        .bind(dose)
        .execute(&w.app.db)
        .await?;

    let given = json!({ "status": "given", "witnessed_by": member.user_id });
    assert_eq!(w.mark(dose, &given).await?, StatusCode::OK);
    assert_eq!(w.dose_row(dose).await?.2, Some(member.user_id));
    Ok(())
}
