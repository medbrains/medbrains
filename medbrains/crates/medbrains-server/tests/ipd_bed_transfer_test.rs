//! Moving an admitted patient to another bed.
//!
//! A transfer is three facts that must change together: the admission names
//! the new bed and ward, the new bed is occupied by this admission, and the
//! old bed goes to housekeeping rather than straight back on the board. A
//! transfer that half-lands leaves two beds claiming one patient, or a dirty
//! bed offered to the next admission. Refusals must leave all three as they
//! were, and two nurses racing for the last clean bed must not both get it.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// An admitted patient on a bed of its own, with the admin session.
struct Bedded {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    admission: Uuid,
    bed: Uuid,
}

/// Admit a fresh patient onto a fresh vacant bed; returns (admission, bed).
async fn admit_patient(app: &common::TestApp, csrf: &str, tenant: Uuid) -> R<(Uuid, Uuid)> {
    let (_, bed) = common::vacant_ward_bed(app, tenant).await;
    let doctor = common::provision_staff(app, csrf, "doctor", &[]).await;
    let depts: Value = app
        .get(&app.client, "/api/setup/departments")
        .await
        .json()
        .await?;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", csrf)
        .json(
            &json!({ "first_name": "Bed", "last_name": "Transfer", "gender": "male",
                       "date_of_birth": "1968-03-03", "phone": "9990000081" }),
        )
        .send()
        .await?
        .json()
        .await?;
    let resp = app
        .client
        .post(app.url("/api/ipd/admissions"))
        .header("x-csrf-token", csrf)
        .json(
            &json!({ "patient_id": patient["id"], "department_id": depts[0]["id"],
                       "bed_id": bed, "doctor_id": doctor.user_id }),
        )
        .send()
        .await?;
    assert_eq!(resp.status(), StatusCode::OK, "admit onto the bed");
    let created: Value = resp.json().await?;
    let admission = created["admission"]["id"]
        .as_str()
        .ok_or("admission id")?
        .parse()?;
    Ok((admission, bed))
}

/// A test server with one admitted patient on a bed of its own.
async fn setup() -> R<Bedded> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    let (admission, bed) = admit_patient(&app, &csrf, tenant).await?;
    Ok(Bedded {
        app,
        csrf,
        tenant,
        admission,
        bed,
    })
}

/// Send a transfer request for `admission` as the admin.
async fn send_transfer(
    b: &Bedded,
    admission: Uuid,
    method: reqwest::Method,
    body: &Value,
) -> R<StatusCode> {
    let path = format!("/api/ipd/admissions/{admission}/transfer");
    let resp = b
        .app
        .client
        .request(method, b.app.url(&path))
        .header("x-csrf-token", &b.csrf)
        .json(body)
        .send()
        .await?;
    Ok(resp.status())
}

impl Bedded {
    /// Send a transfer request for this admission as the admin.
    async fn transfer(&self, method: reqwest::Method, body: &Value) -> R<StatusCode> {
        send_transfer(self, self.admission, method, body).await
    }

    /// The bed's state and the admission holding it, read from the table.
    async fn bed_state(&self, bed: Uuid) -> R<(String, Option<Uuid>)> {
        Ok(sqlx::query_as(
            "SELECT status::text, admission_id FROM bed_states \
              WHERE tenant_id = $1 AND location_id = $2",
        )
        .bind(self.tenant)
        .bind(bed)
        .fetch_one(&self.app.db)
        .await?)
    }

    /// The bed the admission currently names.
    async fn admission_bed(&self) -> R<Option<Uuid>> {
        Ok(
            sqlx::query_scalar("SELECT bed_id FROM admissions WHERE id = $1")
                .bind(self.admission)
                .fetch_one(&self.app.db)
                .await?,
        )
    }

    /// How many transfer log rows this admission has.
    async fn transfer_logs(&self) -> R<i64> {
        Ok(
            sqlx::query_scalar("SELECT count(*) FROM ipd_transfer_logs WHERE admission_id = $1")
                .bind(self.admission)
                .fetch_one(&self.app.db)
                .await?,
        )
    }
}

/// Given a patient on bed A, When the nurse moves them to clean bed B, Then
/// the admission names B in B's ward, B is occupied by this admission, A is
/// vacant-dirty with a turnaround opened, and one transfer is logged.
#[tokio::test]
async fn a_transfer_moves_the_patient_and_sends_the_old_bed_to_housekeeping() -> R<()> {
    let b = setup().await?;
    let (to_ward, to_bed) = common::vacant_ward_bed(&b.app, b.tenant).await;

    let status = b
        .transfer(
            reqwest::Method::PUT,
            &json!({ "bed_id": to_bed, "notes": "Needs isolation" }),
        )
        .await?;
    assert_eq!(status, StatusCode::OK);

    assert_eq!(b.admission_bed().await?, Some(to_bed));
    let ward: Option<Uuid> = sqlx::query_scalar("SELECT ward_id FROM admissions WHERE id = $1")
        .bind(b.admission)
        .fetch_one(&b.app.db)
        .await?;
    assert_eq!(
        ward,
        Some(to_ward),
        "the admission follows the bed into its ward"
    );
    assert_eq!(
        b.bed_state(to_bed).await?,
        ("occupied".to_owned(), Some(b.admission))
    );
    assert_eq!(b.bed_state(b.bed).await?, ("vacant_dirty".to_owned(), None));
    let turnarounds: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM bed_turnaround_log WHERE bed_id = $1 AND admission_id = $2",
    )
    .bind(b.bed)
    .bind(b.admission)
    .fetch_one(&b.app.db)
    .await?;
    assert_eq!(
        turnarounds, 1,
        "housekeeping is told to turn the old bed round"
    );
    assert_eq!(b.transfer_logs().await?, 1);
    Ok(())
}

/// Given a patient on bed A, When a transfer names no reason, the same bed, the
/// dirty bed just left, or a bed another patient occupies, Then each is refused
/// 400 and the admission, both beds and the transfer log are unchanged.
#[tokio::test]
async fn a_refused_transfer_changes_nothing() -> R<()> {
    let b = setup().await?;
    let (_, clean) = common::vacant_ward_bed(&b.app, b.tenant).await;
    let other = {
        let (_, bed) = common::vacant_ward_bed(&b.app, b.tenant).await;
        sqlx::query("UPDATE bed_states SET status = 'occupied'::bed_status WHERE location_id = $1")
            .bind(bed)
            .execute(&b.app.db)
            .await?;
        bed
    };
    let dirty = {
        let (_, bed) = common::vacant_ward_bed(&b.app, b.tenant).await;
        sqlx::query(
            "UPDATE bed_states SET status = 'vacant_dirty'::bed_status WHERE location_id = $1",
        )
        .bind(bed)
        .execute(&b.app.db)
        .await?;
        bed
    };

    let refused = [
        json!({ "bed_id": clean }),
        json!({ "bed_id": clean, "notes": "   " }),
        json!({ "bed_id": b.bed, "notes": "Same bed" }),
        json!({ "bed_id": dirty, "notes": "Not cleaned yet" }),
        json!({ "bed_id": other, "notes": "Someone is in it" }),
        json!({ "bed_id": Uuid::new_v4(), "notes": "No such bed" }),
    ];
    for body in &refused {
        let status = b.transfer(reqwest::Method::PUT, body).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
    }

    assert_eq!(b.admission_bed().await?, Some(b.bed));
    assert_eq!(
        b.bed_state(b.bed).await?,
        ("occupied".to_owned(), Some(b.admission))
    );
    assert_eq!(b.bed_state(clean).await?, ("vacant_clean".to_owned(), None));
    assert_eq!(b.transfer_logs().await?, 0);
    Ok(())
}

/// Given the structured transfer form, When the reason is under three letters
/// or the type is unknown, Then it is refused; When it is an inter-department
/// move, Then the log records that type and the reason given.
#[tokio::test]
async fn the_structured_transfer_validates_and_logs_its_type() -> R<()> {
    let b = setup().await?;
    let (_, to_bed) = common::vacant_ward_bed(&b.app, b.tenant).await;
    let post = reqwest::Method::POST;

    let short = json!({ "to_bed_id": to_bed, "reason": " ok " });
    assert_eq!(
        b.transfer(post.clone(), &short).await?,
        StatusCode::BAD_REQUEST
    );
    let odd = json!({ "to_bed_id": to_bed, "reason": "Step down", "transfer_type": "teleport" });
    assert_eq!(
        b.transfer(post.clone(), &odd).await?,
        StatusCode::BAD_REQUEST
    );
    assert_eq!(b.transfer_logs().await?, 0);

    let good = json!({ "to_bed_id": to_bed, "reason": "Step down to surgery",
                       "transfer_type": "inter_department" });
    assert_eq!(b.transfer(post, &good).await?, StatusCode::OK);
    let (kind, reason): (String, String) = sqlx::query_as(
        "SELECT transfer_type::text, reason FROM ipd_transfer_logs WHERE admission_id = $1",
    )
    .bind(b.admission)
    .fetch_one(&b.app.db)
    .await?;
    assert_eq!(
        (kind.as_str(), reason.as_str()),
        ("inter_department", "Step down to surgery")
    );
    assert_eq!(
        b.bed_state(to_bed).await?,
        ("occupied".to_owned(), Some(b.admission))
    );
    Ok(())
}

/// Given one clean bed and two admitted patients, When both are moved to it at
/// the same moment, Then exactly one transfer succeeds and the bed holds that
/// patient alone.
#[tokio::test]
async fn two_transfers_to_the_last_clean_bed_place_one_patient() -> R<()> {
    let first = setup().await?;
    let (second, _) = admit_patient(&first.app, &first.csrf, first.tenant).await?;
    let (_, bed) = common::vacant_ward_bed(&first.app, first.tenant).await;
    let body_a = json!({ "bed_id": bed, "notes": "Closer to the station" });
    let body_b = json!({ "bed_id": bed, "notes": "Needs the monitor" });

    let (a, b) = tokio::join!(
        first.transfer(reqwest::Method::PUT, &body_a),
        send_transfer(&first, second, reqwest::Method::PUT, &body_b)
    );
    let mut statuses = [a?, b?];
    statuses.sort_by_key(StatusCode::as_u16);
    assert_eq!(statuses, [StatusCode::OK, StatusCode::BAD_REQUEST]);

    let (state, holder) = first.bed_state(bed).await?;
    assert_eq!(state, "occupied");
    let holders = [first.admission, second];
    assert!(holder.is_some_and(|h| holders.contains(&h)));
    let named: i64 = sqlx::query_scalar("SELECT count(*) FROM admissions WHERE bed_id = $1")
        .bind(bed)
        .fetch_one(&first.app.db)
        .await?;
    assert_eq!(named, 1, "one admission names the bed");
    Ok(())
}

/// Given a nurse who holds the transfer permission but is not on this
/// patient's care team, When she moves the patient, Then the server answers
/// 404 and the patient stays on bed A; When she is granted the admission, Then
/// the same transfer succeeds.
#[tokio::test]
async fn a_nurse_off_the_care_team_cannot_move_the_patient() -> R<()> {
    let b = setup().await?;
    let (_, to_bed) = common::vacant_ward_bed(&b.app, b.tenant).await;
    let nurse = common::provision_staff(&b.app, &b.csrf, "nurse", &[]).await;
    let path = format!("/api/ipd/admissions/{}/transfer", b.admission);
    let body = json!({ "bed_id": to_bed, "notes": "Move nearer the station" });
    let send = || {
        nurse
            .client
            .put(b.app.url(&path))
            .header("x-csrf-token", &nurse.csrf)
            .json(&body)
            .send()
    };

    assert_eq!(send().await?.status(), StatusCode::NOT_FOUND);
    assert_eq!(b.admission_bed().await?, Some(b.bed));
    assert_eq!(
        b.bed_state(to_bed).await?,
        ("vacant_clean".to_owned(), None)
    );

    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                subject_type, subject_id, granted_by) \
         VALUES ($1, 'admission', $2, 'viewer', 'user', $3::text, $3)",
    )
    .bind(b.tenant)
    .bind(b.admission)
    .bind(nurse.user_id)
    .execute(&b.app.db)
    .await?;
    assert_eq!(send().await?.status(), StatusCode::OK);
    assert_eq!(b.admission_bed().await?, Some(to_bed));
    Ok(())
}
