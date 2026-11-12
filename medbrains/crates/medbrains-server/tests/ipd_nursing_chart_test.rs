//! The ward chart a nurse keeps between rounds: tasks, the fluid balance,
//! running infusions and the shift handover.
//!
//! Each is a record somebody will read later as fact. A task shows who did it;
//! the balance decides whether a patient is overloaded; an ended infusion is a
//! bag nobody should restart; an acknowledged handover says the next nurse
//! took the patient over. These tests hold each of those meanings.

use crate::common;

use reqwest::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// An admitted patient, the admin who admitted them, and the admin's id.
struct Ward {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    admin: Uuid,
    admission: Uuid,
}

/// Admit a fresh patient, without a bed.
async fn admit() -> R<Ward> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, admin): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
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
            &json!({ "first_name": "Chart", "last_name": "Ward", "gender": "male",
                       "date_of_birth": "1950-05-05", "phone": "9990000083" }),
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
        admin,
        admission,
    })
}

impl Ward {
    /// Send `body` to the admission's `sub` path as the admin.
    async fn send(&self, method: Method, sub: &str, body: &Value) -> R<(StatusCode, Value)> {
        let path = format!("/api/ipd/admissions/{}/{sub}", self.admission);
        let resp = self
            .app
            .client
            .request(method, self.app.url(&path))
            .header("x-csrf-token", &self.csrf)
            .json(body)
            .send()
            .await?;
        let status = resp.status();
        Ok((status, resp.json().await.unwrap_or(Value::Null)))
    }

    /// Send as `staff` instead of the admin.
    async fn send_as(&self, staff: &common::Staff, sub: &str, body: &Value) -> R<StatusCode> {
        let path = format!("/api/ipd/admissions/{}/{sub}", self.admission);
        let resp = staff
            .client
            .put(self.app.url(&path))
            .header("x-csrf-token", &staff.csrf)
            .json(body)
            .send()
            .await?;
        Ok(resp.status())
    }

    /// A nurse on this admission's care team.
    async fn ward_nurse(&self) -> R<common::Staff> {
        let nurse = common::provision_staff(&self.app, &self.csrf, "nurse", &[]).await;
        sqlx::query(
            "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                    subject_type, subject_id, granted_by) \
             VALUES ($1, 'admission', $2, 'viewer', 'user', $3::text, $3)",
        )
        .bind(self.tenant)
        .bind(self.admission)
        .bind(nurse.user_id)
        .execute(&self.app.db)
        .await?;
        Ok(nurse)
    }
}

/// A task's completion fields: done, by whom, when.
type Completion = (bool, Option<Uuid>, Option<chrono::DateTime<chrono::Utc>>);

/// Read a task's completion fields from the table.
async fn task_row(db: &sqlx::PgPool, id: Uuid) -> R<Completion> {
    Ok(sqlx::query_as(
        "SELECT is_completed, completed_by, completed_at FROM nursing_tasks WHERE id = $1",
    )
    .bind(id)
    .fetch_one(db)
    .await?)
}

/// Given a task the admin ticked done, When a nurse ticks it again, Then it
/// still shows the admin and the first time; When it is unticked, Then it
/// shows no completer at all.
#[tokio::test]
async fn a_done_task_keeps_who_did_it_and_a_reopened_one_shows_nobody() -> R<()> {
    let w = admit().await?;
    let nurse = w.ward_nurse().await?;
    let task = json!({ "task_type": "dressing", "description": "Change the IV site dressing" });
    let (status, created) = w.send(Method::POST, "tasks", &task).await?;
    assert_eq!(status, StatusCode::OK, "{created}");
    let sub = format!("tasks/{}", created["id"].as_str().ok_or("task id")?);
    let id: Uuid = created["id"].as_str().ok_or("task id")?.parse()?;

    let done = json!({ "is_completed": true });
    assert_eq!(w.send(Method::PUT, &sub, &done).await?.0, StatusCode::OK);
    let first = task_row(&w.app.db, id).await?;
    assert_eq!((first.0, first.1), (true, Some(w.admin)));

    assert_eq!(w.send_as(&nurse, &sub, &done).await?, StatusCode::OK);
    assert_eq!(
        task_row(&w.app.db, id).await?,
        first,
        "a second tick rewrote who did it"
    );

    let reopen = json!({ "is_completed": false });
    assert_eq!(w.send(Method::PUT, &sub, &reopen).await?.0, StatusCode::OK);
    assert_eq!(task_row(&w.app.db, id).await?, (false, None, None));
    Ok(())
}

/// A millilitre figure, whether the server sent it as a number or a string.
fn ml(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|v| v.parse().ok()))
}

/// How many I/O entries the admission has.
async fn io_rows(w: &Ward) -> R<i64> {
    Ok(
        sqlx::query_scalar("SELECT count(*) FROM ipd_intake_output WHERE admission_id = $1")
            .bind(w.admission)
            .fetch_one(&w.app.db)
            .await?,
    )
}

/// Given an empty chart, When intake of 0 ml, intake of -500 ml or output of
/// -50 ml is recorded, Then each is refused and nothing is stored; When urine
/// output of 0 ml is recorded (an anuric patient), Then it is kept; When 500 ml
/// in and 200 ml out are recorded, Then the balance is +300 ml.
#[tokio::test]
async fn the_fluid_balance_refuses_negatives_and_keeps_a_zero_output() -> R<()> {
    let w = admit().await?;
    let entry = |is_intake: bool, volume: i32| {
        json!({ "is_intake": is_intake, "category": if is_intake { "oral" } else { "urine" },
                "volume_ml": volume, "shift": "night" })
    };
    for (is_intake, volume) in [(true, 0), (true, -500), (false, -50)] {
        let body = entry(is_intake, volume);
        assert_eq!(
            w.send(Method::POST, "io", &body).await?.0,
            StatusCode::BAD_REQUEST,
            "{body}"
        );
    }
    assert_eq!(io_rows(&w).await?, 0, "a refused entry must not be stored");

    assert_eq!(
        w.send(Method::POST, "io", &entry(false, 0)).await?.0,
        StatusCode::OK
    );
    assert_eq!(io_rows(&w).await?, 1, "urine 0 ml is a finding, not a typo");

    assert_eq!(
        w.send(Method::POST, "io", &entry(true, 500)).await?.0,
        StatusCode::OK
    );
    assert_eq!(
        w.send(Method::POST, "io", &entry(false, 200)).await?.0,
        StatusCode::OK
    );
    let (_, balance) = w.send(Method::GET, "io/balance", &Value::Null).await?;
    let keys = ["total_intake_ml", "total_output_ml", "balance_ml"];
    assert_eq!(
        keys.map(|k| ml(&balance[k])),
        [Some(500.0), Some(200.0), Some(300.0)],
        "{balance}"
    );
    Ok(())
}

/// Given a pump, When it is started or titrated at 0 ml/hr, Then it is refused;
/// Given a completed infusion, When it is resumed, discontinued or titrated,
/// Then each is refused 409 and its end time is unchanged.
#[tokio::test]
async fn an_ended_infusion_stays_ended() -> R<()> {
    let w = admit().await?;
    let zero = json!({ "fluid_name": "Normal saline", "volume_ml": 1000, "rate_ml_per_hr": 0 });
    assert_eq!(
        w.send(Method::POST, "infusions", &zero).await?.0,
        StatusCode::BAD_REQUEST
    );

    let bag = json!({ "fluid_name": "Normal saline", "volume_ml": 1000, "rate_ml_per_hr": 100 });
    let (status, inf) = w.send(Method::POST, "infusions", &bag).await?;
    assert_eq!(status, StatusCode::OK, "{inf}");
    let sub = format!("infusions/{}", inf["id"].as_str().ok_or("infusion id")?);
    let stop = json!({ "rate_ml_per_hr": -5 });
    assert_eq!(
        w.send(Method::PUT, &sub, &stop).await?.0,
        StatusCode::BAD_REQUEST
    );

    let (status, done) = w
        .send(Method::PUT, &sub, &json!({ "status": "completed" }))
        .await?;
    assert_eq!(status, StatusCode::OK);
    let ended = done["actual_end_time"].clone();
    assert!(ended.is_string(), "{done}");

    let after = [
        json!({ "status": "running" }),
        json!({ "status": "discontinued", "discontinued_reason": "Line tissued" }),
        json!({ "rate_ml_per_hr": 50 }),
    ];
    for body in &after {
        assert_eq!(
            w.send(Method::PUT, &sub, body).await?.0,
            StatusCode::CONFLICT,
            "{body}"
        );
    }
    let (_, list) = w.send(Method::GET, "infusions", &Value::Null).await?;
    let row = list
        .as_array()
        .and_then(|r| r.first())
        .ok_or("infusion row")?;
    assert_eq!(
        (row["status"].as_str(), &row["actual_end_time"]),
        (Some("completed"), &ended)
    );
    Ok(())
}

/// Given an outgoing nurse's handover, When it names herself or nobody known
/// as the incoming nurse, Then it is refused; When the outgoing side tries to
/// acknowledge it, Then 403 and it stays unacknowledged; When the incoming
/// nurse acknowledges, Then it is acknowledged, once.
#[tokio::test]
async fn only_the_incoming_nurse_acknowledges_a_handover() -> R<()> {
    let w = admit().await?;
    let nurse = w.ward_nurse().await?;
    let handover = |incoming: Uuid| {
        json!({ "shift": "night", "handover_date": "2026-11-12", "incoming_nurse": incoming,
                "situation": "Post-op day 1, stable", "recommendation": "Mobilise at 08:00" })
    };
    for incoming in [w.admin, Uuid::new_v4()] {
        let (status, _) = w
            .send(Method::POST, "handovers", &handover(incoming))
            .await?;
        assert_eq!(status, StatusCode::BAD_REQUEST);
    }
    let (status, report) = w
        .send(Method::POST, "handovers", &handover(nurse.user_id))
        .await?;
    assert_eq!(status, StatusCode::OK, "{report}");
    let id: Uuid = report["id"].as_str().ok_or("handover id")?.parse()?;
    let ack = format!("handovers/{id}/acknowledge");
    let acknowledged = || async {
        sqlx::query_scalar::<_, Option<chrono::DateTime<chrono::Utc>>>(
            "SELECT acknowledged_at FROM ipd_handover_reports WHERE id = $1",
        )
        .bind(id)
        .fetch_one(&w.app.db)
        .await
    };

    assert_eq!(
        w.send(Method::PUT, &ack, &json!({})).await?.0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        acknowledged().await?,
        None,
        "a refused receipt must not be kept"
    );

    assert_eq!(w.send_as(&nurse, &ack, &json!({})).await?, StatusCode::OK);
    assert!(acknowledged().await?.is_some());
    assert_eq!(
        w.send_as(&nurse, &ack, &json!({})).await?,
        StatusCode::NOT_FOUND
    );
    Ok(())
}
