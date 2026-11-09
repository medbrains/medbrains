#![allow(dead_code, unreachable_pub)]

//! The world the dispense-control tests run in: a hospital department with a
//! doctor allowed to prescribe Schedule X, and two pharmacists in it, created
//! through the admin API with the built-in role and nothing more, so no check
//! passes because the caller bypasses it. The second pharmacist witnesses.

use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::common;

/// A signed-in member of staff.
pub struct Signed {
    pub client: Client,
    pub csrf: String,
    pub user_id: Uuid,
    pub username: String,
    pub password: String,
}

/// One department's pharmacy counter, a doctor, and a patient on a visit.
pub struct Desk {
    pub app: common::TestApp,
    pub admin_csrf: String,
    pub tenant: Uuid,
    pub department: Uuid,
    pub doctor: Uuid,
    pub pharmacist: Signed,
    pub witness: Signed,
    pub patient: Uuid,
    pub encounter: Uuid,
}

/// A short unique tag for names and codes.
pub fn tag() -> String {
    Uuid::new_v4().simple().to_string()[..10].to_owned()
}

/// Creates `role` in `department` through the admin API, granting `extra`
/// on top of the role, and signs them in on their own cookie jar.
pub async fn staff(
    app: &common::TestApp,
    admin_csrf: &str,
    (role, department): (&str, Uuid),
    extra: &[&str],
) -> Signed {
    let t = tag();
    let (username, password) = (format!("dw{role}_{t}"), format!("Desk#{t}Aa9"));
    let resp = app
        .client
        .post(app.url("/api/setup/users"))
        .header("x-csrf-token", admin_csrf)
        .json(&json!({
            "username": username,
            "email": format!("{username}@example.test"),
            "password": password,
            "full_name": format!("Desk {role} {t}"),
            "role": role,
            "department_ids": [department],
        }))
        .send()
        .await
        .expect("provision");
    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "{}",
        resp.text().await.unwrap_or_default()
    );
    let user_id: Uuid = sqlx::query_scalar(
        "UPDATE users SET access_matrix = jsonb_build_object('extra', $2::jsonb, \
                                                             'denied', '[]'::jsonb), \
                perm_version = perm_version + 1 \
          WHERE username = $1 RETURNING id",
    )
    .bind(&username)
    .bind(json!(extra))
    .fetch_one(&app.db)
    .await
    .expect("user");
    sign_in(app, (user_id, username, password)).await
}

/// Signs an existing user in on a fresh cookie jar.
pub async fn sign_in(
    app: &common::TestApp,
    (user_id, username, password): (Uuid, String, String),
) -> Signed {
    let client = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = client
        .post(app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    let csrf = login["csrf_token"].as_str().unwrap_or_default().to_owned();
    assert!(!csrf.is_empty(), "signed in: {login}");
    Signed {
        client,
        csrf,
        user_id,
        username,
        password,
    }
}

/// The desk: a department, its doctor, two pharmacists, a patient on a visit
/// whose allergy status is recorded ("no known allergies").
pub async fn desk() -> Desk {
    let app = common::spawn_app().await;
    let admin_csrf = app.login_admin().await;
    let tenant: Uuid = sqlx::query_scalar("SELECT tenant_id FROM users WHERE username = 'admin'")
        .fetch_one(&app.db)
        .await
        .expect("tenant");
    let t = tag().to_uppercase();
    let department: Uuid = sqlx::query_scalar(
        "INSERT INTO departments (tenant_id, code, name, department_type) \
         VALUES ($1, $2, $3, 'clinical') RETURNING id",
    )
    .bind(tenant)
    .bind(format!("DW{t}"))
    .bind(format!("Dispense desk {t}"))
    .fetch_one(&app.db)
    .await
    .expect("department");
    let doctor = staff(&app, &admin_csrf, ("doctor", department), &[])
        .await
        .user_id;
    sqlx::query(
        "INSERT INTO doctor_profiles (tenant_id, user_id, display_name, can_prescribe_schedule_x) \
         VALUES ($1, $2, 'Dr Desk', true) \
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET can_prescribe_schedule_x = true",
    )
    .bind(tenant)
    .bind(doctor)
    .execute(&app.db)
    .await
    .expect("doctor profile");
    let pharmacist = staff(&app, &admin_csrf, ("pharmacist", department), &[]).await;
    let witness = staff(&app, &admin_csrf, ("pharmacist", department), &[]).await;
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, \
                               no_known_allergies) \
         VALUES ($1, $2, 'Desk', 'Patient', 'female', $3, true) RETURNING id",
    )
    .bind(tenant)
    .bind(format!("UH-DW-{t}"))
    .bind(format!("6{}", &Uuid::new_v4().as_u128().to_string()[..9]))
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
    Desk {
        app,
        admin_csrf,
        tenant,
        department,
        doctor,
        pharmacist,
        witness,
        patient,
        encounter,
    }
}

impl Desk {
    /// A catalogue drug of `schedule` (None for none), 500 on the shelf.
    pub async fn drug(&self, schedule: Option<&str>, controlled: bool) -> Uuid {
        let t = tag();
        sqlx::query_scalar(
            "INSERT INTO pharmacy_catalog (tenant_id, code, name, generic_name, drug_schedule, \
                                           is_controlled, base_price, current_stock) \
             VALUES ($1, $2, $3, $4, $5, $6, 10.00, 500) RETURNING id",
        )
        .bind(self.tenant)
        .bind(format!("DW-{t}"))
        .bind(format!("Deskdrug {t}"))
        .bind(format!("deskdrug{t}"))
        .bind(schedule)
        .bind(controlled)
        .fetch_one(&self.app.db)
        .await
        .expect("catalog")
    }

    /// An opening receipt of `quantity` on the drug's NDPS register.
    pub async fn ndps_receipt(&self, drug: Uuid, quantity: i32) {
        sqlx::query(
            "INSERT INTO pharmacy_ndps_register (tenant_id, catalog_item_id, action, quantity, \
                                                 balance_after, dispensed_by, notes) \
             VALUES ($1, $2, 'receipt', $3, $3, $4, 'Opening balance')",
        )
        .bind(self.tenant)
        .bind(drug)
        .bind(quantity)
        .bind(self.pharmacist.user_id)
        .execute(&self.app.db)
        .await
        .expect("receipt");
    }

    /// A signed, written prescription by the doctor on the visit; each item
    /// is (drug, stated quantity, frequency), 1 tab for 5 days.
    pub async fn prescription(&self, items: &[(Uuid, Option<i32>, &str)]) -> Uuid {
        let id: Uuid = sqlx::query_scalar(
            "INSERT INTO prescriptions (tenant_id, encounter_id, doctor_id, patient_id, \
                                        valid_until, order_mode) \
             VALUES ($1, $2, $3, $4, '2999-01-01', 'written') RETURNING id",
        )
        .bind(self.tenant)
        .bind(self.encounter)
        .bind(self.doctor)
        .bind(self.patient)
        .fetch_one(&self.app.db)
        .await
        .expect("prescription");
        for (drug, quantity, frequency) in items {
            sqlx::query(
                "INSERT INTO prescription_items (tenant_id, prescription_id, drug_name, dosage, \
                                                 frequency, duration, catalog_item_id, quantity) \
                 VALUES ($1, $2, 'as prescribed', '1 tab', $3, '5 days', $4, $5)",
            )
            .bind(self.tenant)
            .bind(id)
            .bind(*frequency)
            .bind(drug)
            .bind(quantity)
            .execute(&self.app.db)
            .await
            .expect("prescription item");
        }
        sqlx::query("UPDATE prescriptions SET is_signed = true WHERE id = $1")
            .bind(id)
            .execute(&self.app.db)
            .await
            .expect("sign");
        id
    }

    /// An order for `quantity` of `drug` on `prescription`, waiting at the counter.
    pub async fn order(&self, prescription: Option<Uuid>, drug: Uuid, quantity: i32) -> Uuid {
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
        self.add_line(order, drug, quantity).await;
        order
    }

    /// One more line on an order.
    pub async fn add_line(&self, order: Uuid, drug: Uuid, quantity: i32) {
        sqlx::query(
            "INSERT INTO pharmacy_order_items (tenant_id, order_id, catalog_item_id, drug_name, \
                                               quantity, unit_price, total_price) \
             SELECT $1, $2, id, name, $4, 10.00, 10.00 * $4 FROM pharmacy_catalog WHERE id = $3",
        )
        .bind(self.tenant)
        .bind(order)
        .bind(drug)
        .bind(quantity)
        .execute(&self.app.db)
        .await
        .expect("order item");
    }

    /// Marks an order as already dispensed in full, as an earlier fill.
    pub async fn mark_dispensed(&self, order: Uuid) {
        sqlx::query(
            "UPDATE pharmacy_order_items SET quantity_dispensed = quantity WHERE order_id = $1",
        )
        .bind(order)
        .execute(&self.app.db)
        .await
        .expect("dispensed lines");
        sqlx::query("UPDATE pharmacy_orders SET status = 'dispensed' WHERE id = $1")
            .bind(order)
            .execute(&self.app.db)
            .await
            .expect("dispensed order");
    }

    /// The pharmacist dispenses the whole order, past the payment question,
    /// with `extra` merged into the body.
    pub async fn dispense(&self, order: Uuid, extra: Value) -> (StatusCode, Value) {
        dispense_as(&self.app, &self.pharmacist, order, extra).await
    }

    /// The witness, confirming with their own password.
    pub fn witnessed(&self) -> Value {
        json!({
            "witnessed_by": self.witness.user_id,
            "witness_password": self.witness.password,
        })
    }

    /// A pack-and-collect store with one shelf batch of each drug.
    pub async fn pack_store(&self, drugs: &[Uuid]) -> Uuid {
        let t = tag();
        let store: Uuid = sqlx::query_scalar(
            "INSERT INTO store_locations (tenant_id, code, name) VALUES ($1, $2, $3) RETURNING id",
        )
        .bind(self.tenant)
        .bind(format!("PC-{t}"))
        .bind(format!("Pack and collect {t}"))
        .fetch_one(&self.app.db)
        .await
        .expect("store");
        sqlx::query(
            "INSERT INTO pharmacy_store_assignments (tenant_id, store_location_id, \
                                                     fulfilment_mode) \
             VALUES ($1, $2, 'pack_and_collect')",
        )
        .bind(self.tenant)
        .bind(store)
        .execute(&self.app.db)
        .await
        .expect("store mode");
        for drug in drugs {
            sqlx::query(
                "INSERT INTO pharmacy_batches (tenant_id, catalog_item_id, batch_number, \
                                               expiry_date, quantity_received, quantity_on_hand, \
                                               store_location_id) \
                 VALUES ($1, $2, $3, CURRENT_DATE + 365, 50, 50, $4)",
            )
            .bind(self.tenant)
            .bind(drug)
            .bind(format!("B-{}", tag()))
            .bind(store)
            .execute(&self.app.db)
            .await
            .expect("batch");
        }
        store
    }

    /// The pharmacist claims an order for picking.
    pub async fn claim(&self, order: Uuid, body: Value) -> (StatusCode, Value) {
        self.fulfil(order, "claim", body).await
    }

    /// The pharmacist POSTs `body` to the order's fulfilment `step`.
    pub async fn fulfil(&self, order: Uuid, step: &str, body: Value) -> (StatusCode, Value) {
        let resp = self
            .pharmacist
            .client
            .post(
                self.app
                    .url(&format!("/api/pharmacy/fulfilment/{order}/{step}")),
            )
            .header("x-csrf-token", &self.pharmacist.csrf)
            .json(&body)
            .send()
            .await
            .expect("fulfilment");
        let status = resp.status();
        (status, resp.json().await.unwrap_or(Value::Null))
    }

    /// Rows `cpoe_safety_audit` holds for this order, code and outcome.
    pub async fn filed(&self, order: Uuid, code: &str, action: &str) -> i64 {
        sqlx::query_scalar(
            "SELECT COUNT(*) FROM cpoe_safety_audit \
              WHERE source_record_id = $1 AND warning_code = $2 AND action_taken = $3",
        )
        .bind(order)
        .bind(code)
        .bind(action)
        .fetch_one(&self.app.db)
        .await
        .expect("audit")
    }
}

/// `who` dispenses the whole order, past the payment question.
pub async fn dispense_as(
    app: &common::TestApp,
    who: &Signed,
    order: Uuid,
    extra: Value,
) -> (StatusCode, Value) {
    let mut body = json!({ "unpaid_override_reason": "Credit patient, billed at discharge" });
    if let (Some(base), Some(more)) = (body.as_object_mut(), extra.as_object()) {
        base.extend(more.clone());
    }
    let resp = who
        .client
        .put(app.url(&format!("/api/pharmacy/orders/{order}/dispense")))
        .header("x-csrf-token", &who.csrf)
        .json(&body)
        .send()
        .await
        .expect("dispense");
    let status = resp.status();
    (status, resp.json().await.unwrap_or(Value::Null))
}
