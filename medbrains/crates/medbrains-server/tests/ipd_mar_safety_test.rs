//! The medication record's administration gate (IPSG.3).
//!
//! A high-alert dose — insulin, heparin, potassium — is given only after an
//! independent double check by a second qualified clinician and a wristband
//! and drug scan, and given by a clinician allowed to give it — never by an
//! administrator on the strength of the bypass. A dose recorded as given never changes. A dose held,
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

    /// Put `staff` on this admission's care team, as a ward assignment would.
    async fn join_care_team(&self, staff: &common::Staff) -> R<()> {
        sqlx::query(
            "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                    subject_type, subject_id, granted_by) \
             VALUES ($1, 'admission', $2, 'viewer', 'user', $3::text, $3)",
        )
        .bind(self.tenant)
        .bind(self.admission)
        .bind(staff.user_id)
        .execute(&self.app.db)
        .await?;
        Ok(())
    }

    /// Record a status change on `dose` as `staff`, through `path` (either MAR route).
    async fn mark_as(&self, staff: &common::Staff, path: &str, body: &Value) -> R<StatusCode> {
        let resp = staff
            .client
            .put(self.app.url(path))
            .header("x-csrf-token", &staff.csrf)
            .json(body)
            .send()
            .await?;
        Ok(resp.status())
    }

    /// Both MAR update routes for `dose`: the admission's, then the nurse's.
    fn mar_paths(&self, dose: Uuid) -> [String; 2] {
        [
            format!("/api/ipd/admissions/{}/mar/{dose}", self.admission),
            format!("/api/nurse/mar/{dose}"),
        ]
    }

    /// Mark `dose` as scanned; the scan itself is proved in its own test.
    async fn scanned(&self, dose: Uuid) -> R<()> {
        sqlx::query(
            "UPDATE ipd_medication_administration SET barcode_verified = true WHERE id = $1",
        )
        .bind(dose)
        .execute(&self.app.db)
        .await?;
        Ok(())
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

/// Given a high-alert dose and a nurse on the care team as the giver, When it
/// is marked given with no witness, or with a nurse but no scan (even with the
/// client claiming the scan), Then it is refused; When it has been scanned,
/// Then the giver as witness, an unknown user, a receptionist, the
/// administrator (a bypass role not granted the code by name), and a nurse with
/// `nurse.mar.witness` denied are each refused and the dose stays scheduled;
/// When a second nurse witnesses, Then it is given by the first and witnessed
/// by the second, and cannot be given or held afterwards.
#[tokio::test]
async fn a_high_alert_dose_needs_a_qualified_witness_and_a_scan() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Insulin regular", true).await?;
    let admin: Uuid = sqlx::query_scalar("SELECT id FROM users WHERE username = 'admin'")
        .fetch_one(&w.app.db)
        .await?;
    let giver = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    w.join_care_team(&giver).await?;
    let nurse = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let clerk = common::provision_staff(&w.app, &w.csrf, "receptionist", &[]).await;
    let barred = common::provision_staff(&w.app, &w.csrf, "nurse", &["nurse.mar.witness"]).await;
    let [path, _] = w.mar_paths(dose);

    let refused = [
        json!({ "status": "given" }),
        json!({ "status": "given", "witnessed_by": nurse.user_id }),
        json!({ "status": "given", "witnessed_by": nurse.user_id, "barcode_verified": true }),
    ];
    for body in &refused {
        let status = w.mark_as(&giver, &path, body).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
        assert_eq!(
            w.dose_row(dose).await?,
            ("scheduled".to_owned(), None, None),
            "{body}"
        );
    }

    w.scanned(dose).await?;
    // Scanned, so only the witness can be what refuses these.
    let unqualified = [
        giver.user_id,
        Uuid::new_v4(),
        clerk.user_id,
        admin,
        barred.user_id,
    ];
    for witness in unqualified {
        let body = json!({ "status": "given", "witnessed_by": witness });
        let status = w.mark_as(&giver, &path, &body).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
        assert_eq!(
            w.dose_row(dose).await?,
            ("scheduled".to_owned(), None, None)
        );
    }
    let given = json!({ "status": "given", "witnessed_by": nurse.user_id });
    assert_eq!(w.mark_as(&giver, &path, &given).await?, StatusCode::OK);
    let expected = ("given".to_owned(), Some(giver.user_id), Some(nurse.user_id));
    assert_eq!(w.dose_row(dose).await?, expected);

    assert_eq!(
        w.mark_as(&giver, &path, &given).await?,
        StatusCode::CONFLICT,
        "given is final"
    );
    let undo = json!({ "status": "held", "hold_reason": "Changed my mind" });
    assert_eq!(w.mark_as(&giver, &path, &undo).await?, StatusCode::CONFLICT);
    assert_eq!(w.dose_row(dose).await?, expected);
    Ok(())
}

/// Given a scanned high-alert dose and a qualified witness, When the
/// administrator (a bypass role) or a nurse with
/// `nurse.mar.administer_high_alert` denied marks it given on either MAR route,
/// Then 403 and nobody is recorded as the giver; When a hospital administrator
/// granted the code by name gives it, Then it is given by them. An ordinary
/// dose is still given by the administrator: the gate is the high-alert one.
#[tokio::test]
async fn only_a_clinician_granted_it_by_name_gives_a_high_alert_dose() -> R<()> {
    let w = admit().await?;
    let dose = w.new_dose("Heparin infusion", true).await?;
    w.scanned(dose).await?;
    let witness = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let barred = common::provision_staff(
        &w.app,
        &w.csrf,
        "nurse",
        &["nurse.mar.administer_high_alert"],
    )
    .await;
    w.join_care_team(&barred).await?;
    let given = json!({ "status": "given", "witnessed_by": witness.user_id });

    for path in w.mar_paths(dose) {
        let (status, _) = w.send(Method::PUT, &path, &given).await?;
        assert_eq!(status, StatusCode::FORBIDDEN, "admin on {path}");
        let status = w.mark_as(&barred, &path, &given).await?;
        assert_eq!(status, StatusCode::FORBIDDEN, "denied nurse on {path}");
        assert_eq!(
            w.dose_row(dose).await?,
            ("scheduled".to_owned(), None, None)
        );
    }

    let named = common::provision_staff_with(
        &w.app,
        &w.csrf,
        "hospital_admin",
        &["nurse.mar.administer_high_alert"],
        &[],
    )
    .await;
    let [path, _] = w.mar_paths(dose);
    assert_eq!(w.mark_as(&named, &path, &given).await?, StatusCode::OK);
    let expected = (
        "given".to_owned(),
        Some(named.user_id),
        Some(witness.user_id),
    );
    assert_eq!(w.dose_row(dose).await?, expected);

    let ordinary = w.new_dose("Paracetamol", false).await?;
    let [path, _] = w.mar_paths(ordinary);
    let (status, _) = w
        .send(Method::PUT, &path, &json!({ "status": "given" }))
        .await?;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(w.dose_row(ordinary).await?.0, "given");
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
    w.join_care_team(&nurse).await?;
    let [path, _] = w.mar_paths(dose);
    let held = json!({ "status": "held", "hold_reason": "BP 90/60" });
    assert_eq!(
        w.mark_as(&nurse, &path, &held).await?,
        StatusCode::FORBIDDEN
    );
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
    w.scanned(dose).await?;
    let giver = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    w.join_care_team(&giver).await?;

    let given = json!({ "status": "given", "witnessed_by": member.user_id });
    let [path, _] = w.mar_paths(dose);
    assert_eq!(w.mark_as(&giver, &path, &given).await?, StatusCode::OK);
    assert_eq!(w.dose_row(dose).await?.2, Some(member.user_id));
    Ok(())
}

/// Given a custom role row holding `nurse.mar.administer`, an access group holding
/// `ipd.mar.update`, and a staff user whose `access_matrix.extra` holds `nurse.mar.administer`,
/// all from before #5529, When migration 1456 runs (twice: it is idempotent), Then each holds
/// `nurse.mar.administer_high_alert` exactly once, a role holding neither code does not, and the
/// staff user, signed in again, gives a scanned, witnessed insulin dose.
#[tokio::test]
async fn the_deploy_migration_keeps_custom_givers_giving() -> R<()> {
    const MIGRATION: &str = include_str!(
        "../../medbrains-db-migrations/src/migrations/1456_grant_high_alert_giving.sql"
    );
    const CODE: &str = "nurse.mar.administer_high_alert";
    let w = admit().await?;
    let tag = &Uuid::new_v4().simple().to_string()[..8];
    let icu_role = format!("icu_rn_{tag}");
    let clerk_role = format!("ward_clerk_{tag}");
    for (code, perms) in [
        (
            &icu_role,
            json!([
                "nurse.mar.administer",
                "ipd.mar.list",
                "ipd.admissions.view"
            ]),
        ),
        (&clerk_role, json!(["ipd.mar.list"])),
    ] {
        sqlx::query(
            "INSERT INTO roles (tenant_id, code, name, permissions, is_system) \
             VALUES ($1, $2, $2, $3, false)",
        )
        .bind(w.tenant)
        .bind(code)
        .bind(perms)
        .execute(&w.app.db)
        .await?;
    }
    let group: Uuid = sqlx::query_scalar(
        "INSERT INTO access_groups (tenant_id, code, name, permissions) \
         VALUES ($1, $2, 'Float pool', '[\"ipd.mar.update\"]'::jsonb) RETURNING id",
    )
    .bind(w.tenant)
    .bind(format!("float_{tag}"))
    .fetch_one(&w.app.db)
    .await?;
    let extra =
        common::provision_staff_with(&w.app, &w.csrf, "staff", &["nurse.mar.administer"], &[])
            .await;

    for _ in 0..2 {
        sqlx::raw_sql(MIGRATION).execute(&w.app.db).await?;
    }
    let held = |sql: &'static str, id: String| {
        let db = w.app.db.clone();
        async move {
            sqlx::query_scalar::<_, i64>(sql)
                .bind(id)
                .bind(CODE)
                .fetch_one(&db)
                .await
        }
    };
    let role_sql = "SELECT COUNT(*) FROM roles, jsonb_array_elements_text(permissions) p \
                    WHERE code = $1 AND p = $2";
    assert_eq!(held(role_sql, icu_role.clone()).await?, 1);
    assert_eq!(held(role_sql, clerk_role).await?, 0);
    let group_sql = "SELECT COUNT(*) FROM access_groups, jsonb_array_elements_text(permissions) p \
                     WHERE id = $1::uuid AND p = $2";
    assert_eq!(held(group_sql, group.to_string()).await?, 1);
    let user_sql = "SELECT COUNT(*) FROM users, \
                    jsonb_array_elements_text(access_matrix -> 'extra') p \
                    WHERE id = $1::uuid AND p = $2";
    assert_eq!(held(user_sql, extra.user_id.to_string()).await?, 1);

    // The grant bumped her perm_version, so her session is refused until she signs in again,
    // which is how a deploy hands her the new code.
    let username: String = sqlx::query_scalar("SELECT username FROM users WHERE id = $1")
        .bind(extra.user_id)
        .fetch_one(&w.app.db)
        .await?;
    let login: Value = extra
        .client
        .post(w.app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": extra.password }))
        .send()
        .await?
        .json()
        .await?;
    let extra = common::Staff {
        csrf: login["csrf_token"].as_str().ok_or("csrf")?.to_owned(),
        ..extra
    };
    let dose = w.new_dose("Insulin glargine", true).await?;
    w.scanned(dose).await?;
    w.join_care_team(&extra).await?;
    let witness = common::provision_staff(&w.app, &w.csrf, "nurse", &[]).await;
    let [_, path] = w.mar_paths(dose);
    let given = json!({ "status": "given", "witnessed_by": witness.user_id });
    assert_eq!(w.mark_as(&extra, &path, &given).await?, StatusCode::OK);
    assert_eq!(w.dose_row(dose).await?.1, Some(extra.user_id));
    Ok(())
}
