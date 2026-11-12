//! When the pharmacy may see a patient it is not caring for.
//!
//! `require_patient_pharmacy_access` opens the dispensing view (name, UHID,
//! drug allergies) only while the pharmacy is working for the patient: an open
//! prescription in the Rx queue, or a pharmacy order the pharmacist can view,
//! within 30 days. It replaced a handoff tuple that never expired. Each window
//! edge is a place the pharmacy could keep reading a patient it finished with.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

type R<T> = Result<T, Box<dyn std::error::Error>>;

/// A server, a patient, and a pharmacist on no care team of that patient.
struct Counter {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    doctor: Uuid,
    patient: Uuid,
    pharmacist: common::Staff,
}

/// Set up a patient and a pharmacist who holds no grant on them.
async fn counter() -> R<Counter> {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, doctor): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await?;
    let patient: Value = app
        .client
        .post(app.url("/api/patients"))
        .header("x-csrf-token", &csrf)
        .json(
            &json!({ "first_name": "Rx", "last_name": "Window", "gender": "male",
                       "date_of_birth": "1975-04-04", "phone": "9990000086" }),
        )
        .send()
        .await?
        .json()
        .await?;
    let pharmacist = common::provision_staff(&app, &csrf, "pharmacist", &[]).await;
    Ok(Counter {
        patient: patient["id"].as_str().ok_or("patient id")?.parse()?,
        app,
        csrf,
        tenant,
        doctor,
        pharmacist,
    })
}

impl Counter {
    /// `staff` asks for the dispensing view; returns the status and body.
    async fn view(&self, staff: &common::Staff) -> R<(StatusCode, Value)> {
        let path = format!("/api/pharmacy/patients/{}/dispense-context", self.patient);
        let resp = staff.client.get(self.app.url(&path)).send().await?;
        let status = resp.status();
        Ok((status, resp.json().await.unwrap_or(Value::Null)))
    }

    /// A prescription in the Rx queue with `status`, received `days_ago`.
    async fn rx(&self, status: &str, days_ago: i32) -> R<()> {
        sqlx::query(
            "WITH e AS (INSERT INTO encounters (tenant_id, patient_id, encounter_type) \
                        VALUES ($1, $2, 'opd') RETURNING id), \
                  rx AS (INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id) \
                         SELECT $1, e.id, $3, $2 FROM e RETURNING id, encounter_id) \
             INSERT INTO pharmacy_prescriptions (tenant_id, prescription_id, patient_id, \
                    encounter_id, doctor_id, status, received_at) \
             SELECT $1, rx.id, $2, rx.encounter_id, $3, $4::pharmacy_rx_status, \
                    now() - make_interval(days => $5) FROM rx",
        )
        .bind(self.tenant)
        .bind(self.patient)
        .bind(self.doctor)
        .bind(status)
        .bind(days_ago)
        .execute(&self.app.db)
        .await?;
        Ok(())
    }

    /// A pharmacy order dispensed `days_ago`, which `viewer` may view.
    async fn dispensed_order(&self, days_ago: i32, viewer: Uuid) -> R<()> {
        let order: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_orders (tenant_id, patient_id, status, created_at, dispensed_at) \
             VALUES ($1, $2, 'dispensed', now() - make_interval(days => $3), \
                     now() - make_interval(days => $3)) RETURNING id",
        )
        .bind(self.tenant)
        .bind(self.patient)
        .bind(days_ago)
        .fetch_one(&self.app.db)
        .await?;
        sqlx::query(
            "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                    subject_type, subject_id, granted_by) \
             VALUES ($1, 'pharmacy_order', $2, 'viewer', 'user', $3::text, $3)",
        )
        .bind(self.tenant)
        .bind(order)
        .bind(viewer)
        .execute(&self.app.db)
        .await?;
        Ok(())
    }
}

/// Given a pharmacist on no care team, When the patient has no pharmacy work,
/// a prescription received 31 days ago, or one already dispensed, Then the view
/// answers 404; When an open prescription arrives today, Then she sees the
/// patient's identity and allergies and nothing more.
#[tokio::test]
async fn an_open_prescription_opens_the_dispensing_view_for_thirty_days() -> R<()> {
    let c = counter().await?;
    assert_eq!(c.view(&c.pharmacist).await?.0, StatusCode::NOT_FOUND);

    c.rx("pending_review", 31).await?;
    assert_eq!(
        c.view(&c.pharmacist).await?.0,
        StatusCode::NOT_FOUND,
        "past the window"
    );
    c.rx("dispensed", 0).await?;
    assert_eq!(
        c.view(&c.pharmacist).await?.0,
        StatusCode::NOT_FOUND,
        "the work is done"
    );

    c.rx("pending_review", 0).await?;
    let (status, view) = c.view(&c.pharmacist).await?;
    assert_eq!(status, StatusCode::OK, "{view}");
    let mut keys: Vec<&str> = view
        .as_object()
        .ok_or("object")?
        .keys()
        .map(String::as_str)
        .collect();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "drug_allergies",
            "full_name",
            "no_known_allergies",
            "patient_id",
            "uhid"
        ],
        "the dispensing view is identity and allergies only"
    );
    Ok(())
}

/// Given an open prescription, When the caller holds dispensing but not the Rx
/// queue, Then the prescription opens nothing for her (404); When she can view
/// a pharmacy order dispensed 10 days ago, Then it opens the view; When that
/// order was dispensed 40 days ago, Then it does not.
#[tokio::test]
async fn a_pharmacy_order_opens_the_view_only_to_its_viewer_and_only_while_recent() -> R<()> {
    let c = counter().await?;
    let denied = ["pharmacy.rx_queue.list", "pharmacy.rx_queue.review"];
    let dispenser = common::provision_staff(&c.app, &c.csrf, "pharmacist", &denied).await;
    c.rx("approved", 0).await?;
    assert_eq!(
        c.view(&dispenser).await?.0,
        StatusCode::NOT_FOUND,
        "not her worklist"
    );

    c.dispensed_order(40, dispenser.user_id).await?;
    assert_eq!(
        c.view(&dispenser).await?.0,
        StatusCode::NOT_FOUND,
        "dispensed too long ago"
    );
    c.dispensed_order(10, dispenser.user_id).await?;
    assert_eq!(c.view(&dispenser).await?.0, StatusCode::OK);

    let other = common::provision_staff(&c.app, &c.csrf, "pharmacist", &denied).await;
    assert_eq!(
        c.view(&other).await?.0,
        StatusCode::NOT_FOUND,
        "someone else's order"
    );
    Ok(())
}
