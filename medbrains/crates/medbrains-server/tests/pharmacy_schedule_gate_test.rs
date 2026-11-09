//! The Schedule H/H1/X gate refuses every dispense the Drugs and Cosmetics Act
//! forbids, and names why: a drug that is not on the prescription, more than
//! it prescribes across orders, an unsigned or expired prescription, a verbal
//! Schedule X order, and an order that has only a visit behind it. A dispense
//! the prescription does cover passes the gate.

use crate::common;

use reqwest::StatusCode;
use serde_json::{Value, json};
use uuid::Uuid;

/// One patient's visit, a doctor, and a Schedule H or X drug, in the admin's
/// hospital.
struct World {
    app: common::TestApp,
    csrf: String,
    tenant: Uuid,
    doctor: Uuid,
    patient: Uuid,
    encounter: Uuid,
}

/// How the prescription behind an order is written.
struct Rx<'a> {
    /// The drug the prescription names, and its stated quantity.
    item: Option<(Uuid, Option<i32>)>,
    signed: bool,
    valid_until: &'a str,
    order_mode: &'a str,
}

const VALID: Rx<'static> = Rx {
    item: None,
    signed: true,
    valid_until: "2999-01-01",
    order_mode: "written",
};

async fn world() -> World {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let (tenant, doctor): (Uuid, Uuid) =
        sqlx::query_as("SELECT tenant_id, id FROM users WHERE username = 'admin'")
            .fetch_one(&app.db)
            .await
            .expect("admin");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, 'Schedule', 'Gate', 'female', $3) RETURNING id",
    )
    .bind(tenant)
    .bind(format!(
        "UH-SG-{}",
        &Uuid::new_v4().simple().to_string()[..10]
    ))
    .bind(format!("7{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter: Uuid = sqlx::query_scalar(
        "INSERT INTO encounters (tenant_id, patient_id, encounter_type, status) \
         VALUES ($1, $2, 'opd', 'open') RETURNING id",
    )
    .bind(tenant)
    .bind(patient)
    .fetch_one(&app.db)
    .await
    .expect("encounter");
    World {
        app,
        csrf,
        tenant,
        doctor,
        patient,
        encounter,
    }
}

impl World {
    /// A stocked catalogue drug of this schedule.
    async fn drug(&self, schedule: &str) -> Uuid {
        let tag = Uuid::new_v4().simple().to_string();
        sqlx::query_scalar(
            "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, drug_schedule, \
                                           base_price, current_stock) \
             VALUES ($1, $2, $3, $4, $5, 10.00, 500) RETURNING id",
        )
        .bind(self.tenant)
        .bind(format!("SG-{}", &tag[..12]))
        .bind(format!("Gatedrug {}", &tag[..8]))
        .bind(format!("gatedrug{}", &tag[..8]))
        .bind(schedule)
        .fetch_one(&self.app.db)
        .await
        .expect("catalog")
    }

    /// A prescription on the visit, written as `rx` says.
    async fn prescription(&self, rx: &Rx<'_>) -> Uuid {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id, \
                                        valid_until, order_mode) \
             VALUES ($1, $2, $3, $4, $5::date, $6) RETURNING id",
        )
        .bind(self.tenant)
        .bind(self.encounter)
        .bind(self.doctor)
        .bind(self.patient)
        .bind(rx.valid_until)
        .bind(rx.order_mode)
        .fetch_one(&self.app.db)
        .await
        .expect("prescription");
        if let Some((drug, quantity)) = rx.item {
            sqlx::query(
                "INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, \
                                                 frequency, duration, catalog_item_id, quantity) \
                 VALUES ($1, $2, 'as prescribed', '1 tab', 'BD', '5 days', $3, $4)",
            )
            .bind(self.tenant)
            .bind(id)
            .bind(drug)
            .bind(quantity)
            .execute(&self.app.db)
            .await
            .expect("prescription item");
        }
        // Signed after its items, as the signing flow does.
        sqlx::query("UPDATE prescriptions SET is_signed = $2 WHERE id = $1")
            .bind(id)
            .bind(rx.signed)
            .execute(&self.app.db)
            .await
            .expect("sign");
        id
    }

    /// An order for `quantity` of `drug`, on `prescription` when given.
    async fn order(&self, prescription: Option<Uuid>, drug: Uuid, quantity: i32) -> Uuid {
        let order: Uuid = sqlx::query_scalar(
            "INSERT INTO pharmacy_orders (tenant_id, prescription_id, patient_id, encounter_id, \
                                          ordered_by, status) \
             VALUES ($1, $2, $3, $4, $5, 'ordered') RETURNING id",
        )
        .bind(self.tenant)
        .bind(prescription)
        .bind(self.patient)
        .bind(self.encounter)
        .bind(self.doctor)
        .fetch_one(&self.app.db)
        .await
        .expect("order");
        sqlx::query(
            "INSERT INTO pharmacy_order_items (tenant_id, order_id, catalog_item_id, drug_name, \
                                               quantity, unit_price, total_price, \
                                               quantity_prescribed) \
             SELECT $1, $2, id, name, $4, 10.00, 10.00 * $4, $4 \
               FROM pharmacy_catalog WHERE id = $3",
        )
        .bind(self.tenant)
        .bind(order)
        .bind(drug)
        .bind(quantity)
        .execute(&self.app.db)
        .await
        .expect("order item");
        order
    }

    /// Dispense the whole order, past the allergy and payment questions.
    async fn dispense(&self, order: Uuid) -> (StatusCode, Value) {
        let resp = self
            .app
            .client
            .put(
                self.app
                    .url(&format!("/api/pharmacy/orders/{order}/dispense")),
            )
            .header("x-csrf-token", &self.csrf)
            .json(&json!({
                "allergy_status_acknowledged": true,
                "unpaid_override_reason": "Credit patient, billed at discharge",
            }))
            .send()
            .await
            .expect("dispense");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    /// The dispense is refused by the schedule gate, for `why`.
    async fn refused(&self, order: Uuid, why: &str) {
        let (status, body) = self.dispense(order).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "{body}");
        let text = body.to_string();
        assert!(text.contains("Schedule H/H1/X gate failed"), "{text}");
        assert!(text.contains(why), "expected {why:?} in {text}");
        let filed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM cpoe_safety_audit \
              WHERE source_record_id = $1 AND warning_code = 'SCHEDULE_DISPENSE_REFUSED' \
                AND action_taken = 'blocked'",
        )
        .bind(order)
        .fetch_one(&self.app.db)
        .await
        .expect("audit");
        assert_eq!(filed, 1, "the refusal is filed against the order");
    }
}

#[tokio::test]
async fn a_drug_that_is_not_on_the_prescription_is_refused() {
    let w = world().await;
    let prescribed = w.drug("H").await;
    let other = w.drug("H").await;
    let rx = w
        .prescription(&Rx {
            item: Some((prescribed, Some(10))),
            ..VALID
        })
        .await;
    let order = w.order(Some(rx), other, 5).await;
    w.refused(order, "not on the prescription").await;
}

#[tokio::test]
async fn more_than_prescribed_is_refused_across_orders() {
    let w = world().await;
    let drug = w.drug("H1").await;
    let rx = w
        .prescription(&Rx {
            item: Some((drug, Some(10))),
            ..VALID
        })
        .await;
    let over = w.order(Some(rx), drug, 11).await;
    w.refused(over, "the prescription allows 10").await;

    // Six already went out on an earlier order on the same prescription.
    let earlier = w.order(Some(rx), drug, 6).await;
    sqlx::query("UPDATE pharmacy_order_items SET quantity_dispensed = 6 WHERE order_id = $1")
        .bind(earlier)
        .execute(&w.app.db)
        .await
        .expect("earlier dispense");
    sqlx::query("UPDATE pharmacy_orders SET status = 'dispensed' WHERE id = $1")
        .bind(earlier)
        .execute(&w.app.db)
        .await
        .expect("earlier status");
    let rest = w.order(Some(rx), drug, 5).await;
    w.refused(rest, "6 already went out").await;
}

#[tokio::test]
async fn an_unsigned_prescription_is_refused() {
    let w = world().await;
    let drug = w.drug("H").await;
    let rx = w
        .prescription(&Rx {
            item: Some((drug, Some(10))),
            signed: false,
            ..VALID
        })
        .await;
    let order = w.order(Some(rx), drug, 5).await;
    w.refused(order, "not signed by the doctor").await;
}

#[tokio::test]
async fn an_expired_prescription_is_refused() {
    let w = world().await;
    let drug = w.drug("H").await;
    let rx = w
        .prescription(&Rx {
            item: Some((drug, Some(10))),
            valid_until: "2020-01-01",
            ..VALID
        })
        .await;
    let order = w.order(Some(rx), drug, 5).await;
    w.refused(order, "expired on 2020-01-01").await;
}

#[tokio::test]
async fn a_verbal_schedule_x_order_is_refused() {
    let w = world().await;
    let drug = w.drug("X").await;
    let rx = w
        .prescription(&Rx {
            item: Some((drug, Some(10))),
            order_mode: "verbal",
            ..VALID
        })
        .await;
    let order = w.order(Some(rx), drug, 5).await;
    w.refused(order, "Schedule X and NDPS drugs need a written prescription")
        .await;
}

#[tokio::test]
async fn a_visit_alone_is_not_a_prescription() {
    let w = world().await;
    let drug = w.drug("H").await;
    let order = w.order(None, drug, 5).await;
    w.refused(order, "no prescription for this patient on the order")
        .await;
}

#[tokio::test]
async fn a_signed_prescription_covering_the_line_passes_the_gate() {
    let w = world().await;
    let drug = w.drug("H").await;
    // No stated quantity: 1 tab BD for 5 days counts as ten.
    let rx = w
        .prescription(&Rx {
            item: Some((drug, None)),
            ..VALID
        })
        .await;
    let order = w.order(Some(rx), drug, 10).await;
    let (status, body) = w.dispense(order).await;
    assert_eq!(status, StatusCode::OK, "{body}");
}
