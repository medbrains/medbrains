//! Bed holds, restraint checks and birth records.
//!
//! A bed hold promises one bed to one incoming patient; two holds on the same
//! bed promise it twice. A restraint check is evidence that a restrained
//! patient was looked at, so it must hang on that patient's open restraint
//! order. A birth record becomes a certificate, so impossible measurements
//! are refused before they are stored.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// One test server, the admin session, and the tenant.
struct Ctx {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
}

/// A fresh server signed in as the admin.
async fn ctx() -> R<Ctx> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await?;
    Ok(Ctx { app, csrf, tenant })
}

impl Ctx {
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

    /// A new patient; returns its id.
    async fn patient(&self) -> R<Uuid> {
        let body = json!({ "first_name": "Hold", "last_name": "Probe", "gender": "female",
                           "date_of_birth": "1990-01-01", "phone": "9990000085" });
        let (_, p) = self.send(Method::POST, "/api/patients", &body).await?;
        Ok(p["id"].as_str().ok_or("patient id")?.parse()?)
    }

    /// Admit `patient`, without a bed; returns the admission id.
    async fn admit(&self, patient: Uuid) -> R<Uuid> {
        let doctor = common::provision_staff(&self.app, &self.csrf, "doctor", &[]).await;
        let (_, depts) = self
            .send(Method::GET, "/api/setup/departments", &Value::Null)
            .await?;
        let body = json!({ "patient_id": patient, "department_id": depts[0]["id"],
                           "doctor_id": doctor.user_id });
        let (status, created) = self
            .send(Method::POST, "/api/ipd/admissions", &body)
            .await?;
        assert_eq!(status, StatusCode::OK, "{created}");
        Ok(created["admission"]["id"]
            .as_str()
            .ok_or("admission id")?
            .parse()?)
    }

    /// Open a clinical document of `kind` on `admission`; returns its id.
    async fn clinical_doc(&self, admission: Uuid, kind: &str) -> R<Uuid> {
        let path = format!("/api/ipd/admissions/{admission}/clinical-docs");
        let body = json!({ "doc_type": kind, "title": format!("{kind} order") });
        let (status, doc) = self.send(Method::POST, &path, &body).await?;
        assert_eq!(status, StatusCode::OK, "{doc}");
        Ok(doc["id"].as_str().ok_or("doc id")?.parse()?)
    }

    /// Log a restraint check on `admission` against `doc`; returns the status.
    async fn restraint_check(&self, admission: Uuid, doc: Uuid) -> R<StatusCode> {
        let path = format!("/api/ipd/admissions/{admission}/restraint-checks");
        let body = json!({ "clinical_doc_id": doc, "status": "circulation_ok" });
        Ok(self.send(Method::POST, &path, &body).await?.0)
    }

    /// Live holds on `bed`, read from the table.
    async fn live_holds(&self, bed: Uuid) -> R<i64> {
        Ok(sqlx::query_scalar(
            "SELECT count(*) FROM bed_reservations WHERE bed_id = $1 \
               AND status IN ('active', 'confirmed')",
        )
        .bind(bed)
        .fetch_one(&self.app.db)
        .await?)
    }
}

/// Given a vacant bed, When it is held until a past time, Then 400; When it is
/// held for one patient and then for another, Then the second is 409 and one
/// hold is live; When the hold is released, Then releasing or re-opening it
/// again is 409, and "fulfilled" cannot be set by hand.
#[tokio::test]
async fn a_bed_is_held_once_and_a_released_hold_stays_released() -> R<()> {
    let c = ctx().await?;
    let (_, bed) = common::vacant_ward_bed(&c.app, c.tenant).await;
    let (first, second) = (c.patient().await?, c.patient().await?);
    let hold = |patient: Uuid, until: &str| {
        json!({ "bed_id": bed, "patient_id": patient, "reserved_until": until,
                "purpose": "Post-op from theatre" })
    };
    let later = (chrono::Utc::now() + chrono::Duration::hours(4)).to_rfc3339();
    let path = "/api/ipd/bed-reservations";

    let past = hold(first, "2020-01-01T00:00:00Z");
    assert_eq!(
        c.send(Method::POST, path, &past).await?.0,
        StatusCode::BAD_REQUEST
    );
    let (status, held) = c.send(Method::POST, path, &hold(first, &later)).await?;
    assert_eq!(status, StatusCode::OK, "{held}");
    let twice = hold(second, &later);
    assert_eq!(
        c.send(Method::POST, path, &twice).await?.0,
        StatusCode::CONFLICT
    );
    assert_eq!(c.live_holds(bed).await?, 1);

    let status_path = format!("{path}/{}/status", held["id"].as_str().ok_or("hold id")?);
    let by_hand = json!({ "status": "fulfilled" });
    assert_eq!(
        c.send(Method::PUT, &status_path, &by_hand).await?.0,
        StatusCode::BAD_REQUEST
    );
    let release = json!({ "status": "cancelled" });
    assert_eq!(
        c.send(Method::PUT, &status_path, &release).await?.0,
        StatusCode::OK
    );
    assert_eq!(c.live_holds(bed).await?, 0);
    for again in [release, json!({ "status": "active" })] {
        let (status, _) = c.send(Method::PUT, &status_path, &again).await?;
        assert_eq!(status, StatusCode::CONFLICT, "{again}");
    }
    assert_eq!(c.live_holds(bed).await?, 0);
    Ok(())
}

/// Given a bed set up before beds had state rows (it has none), When it is
/// held, Then the hold is kept and the bed now has its vacant state row.
#[tokio::test]
async fn a_bed_with_no_state_row_can_still_be_held() -> R<()> {
    let c = ctx().await?;
    let (_, bed) = common::vacant_ward_bed(&c.app, c.tenant).await;
    let mut tx = c.app.db.begin().await?;
    sqlx::query("SET LOCAL app.allow_physical_delete = 'true'")
        .execute(&mut *tx)
        .await?;
    sqlx::query("DELETE FROM bed_states WHERE location_id = $1")
        .bind(bed)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    let until = (chrono::Utc::now() + chrono::Duration::hours(2)).to_rfc3339();
    let hold = json!({ "bed_id": bed, "patient_id": c.patient().await?, "reserved_until": until });
    let (status, body) = c
        .send(Method::POST, "/api/ipd/bed-reservations", &hold)
        .await?;
    assert_eq!(status, StatusCode::OK, "{body}");
    let state: String =
        sqlx::query_scalar("SELECT status::text FROM bed_states WHERE location_id = $1")
            .bind(bed)
            .fetch_one(&c.app.db)
            .await?;
    assert_eq!(state, "vacant_clean");
    assert_eq!(c.live_holds(bed).await?, 1);
    Ok(())
}

/// Given two admitted patients, one with an open restraint order, When a check
/// is logged on her order, Then it is kept; When the other admission logs a
/// check against her order, or against a wound-care note, Then 404; When her
/// order is closed, Then a further check is 409.
#[tokio::test]
async fn a_restraint_check_belongs_to_an_open_order_on_the_same_patient() -> R<()> {
    let c = ctx().await?;
    let restrained = c.admit(c.patient().await?).await?;
    let other = c.admit(c.patient().await?).await?;
    let order = c.clinical_doc(restrained, "restraint").await?;
    let wound = c.clinical_doc(restrained, "wound_care").await?;
    assert_eq!(c.restraint_check(restrained, order).await?, StatusCode::OK);
    assert_eq!(
        c.restraint_check(other, order).await?,
        StatusCode::NOT_FOUND,
        "another patient's order"
    );
    assert_eq!(
        c.restraint_check(restrained, wound).await?,
        StatusCode::NOT_FOUND,
        "not a restraint order"
    );

    let resolve = format!("/api/ipd/admissions/{restrained}/clinical-docs/{order}/resolve");
    assert_eq!(
        c.send(Method::POST, &resolve, &json!({})).await?.0,
        StatusCode::OK
    );
    assert_eq!(
        c.restraint_check(restrained, order).await?,
        StatusCode::CONFLICT
    );
    let logged: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM restraint_monitoring_logs WHERE clinical_doc_id = $1",
    )
    .bind(order)
    .fetch_one(&c.app.db)
    .await?;
    assert_eq!(logged, 1);
    Ok(())
}

/// Given a mother's admission, When a birth is recorded with an APGAR of 11, a
/// zero weight, tomorrow's date, or the mother as the baby, Then each is
/// refused and nothing is stored; When a real birth is recorded, Then it is
/// kept, and correcting its APGAR to 12 is refused.
#[tokio::test]
async fn a_birth_record_refuses_impossible_values() -> R<()> {
    let c = ctx().await?;
    let mother = c.patient().await?;
    let admission = c.admit(mother).await?;
    let path = format!("/api/ipd/admissions/{admission}/birth-records");
    let birth = |extra: Value| {
        let mut b = json!({ "date_of_birth": "2026-11-11", "time_of_birth": "04:30:00",
                            "gender": "female", "weight_grams": 3100, "apgar_1min": 8,
                            "apgar_5min": 9, "delivery_type": "normal" });
        if let (Some(b), Some(e)) = (b.as_object_mut(), extra.as_object()) {
            b.extend(e.clone());
        }
        b
    };
    let tomorrow = (chrono::Utc::now() + chrono::Duration::days(2))
        .date_naive()
        .to_string();
    let refused = [
        json!({ "apgar_5min": 11 }),
        json!({ "weight_grams": 0 }),
        json!({ "date_of_birth": tomorrow }),
        json!({ "baby_patient_id": mother }),
    ];
    for extra in refused {
        let (status, body) = c.send(Method::POST, &path, &birth(extra.clone())).await?;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{extra} {body}");
    }
    let stored = || async {
        sqlx::query_scalar::<_, i64>(
            "SELECT count(*) FROM ipd_birth_records WHERE admission_id = $1",
        )
        .bind(admission)
        .fetch_one(&c.app.db)
        .await
    };
    assert_eq!(stored().await?, 0);

    let (status, rec) = c.send(Method::POST, &path, &birth(json!({}))).await?;
    assert_eq!(status, StatusCode::OK, "{rec}");
    let fix = format!("{path}/{}", rec["id"].as_str().ok_or("record id")?);
    let (status, _) = c
        .send(Method::PUT, &fix, &json!({ "apgar_1min": 12 }))
        .await?;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(stored().await?, 1);
    Ok(())
}
