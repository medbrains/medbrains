//! The laboratory reaches the lab order, not the patient's record.
//!
//! Raising a lab order used to hand the whole visit to the Pathology
//! department, so every lab technician could open the patient's chart and
//! every note on it. The order is handed over instead: the lab works it end
//! to end, and the record and the visit answer 404.

use crate::common;

use medbrains_authz::{AuthzBackend, AuthzContext, AuthzError, Relation, RelationTuple, Subject};
use medbrains_server_core::error::AppError;
use medbrains_server_core::middleware::auth::Claims;
use reqwest::{Client, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

/// What one scenario needs: the admin session and a patient with a visit and a
/// lab order on it.
struct World {
    app: common::TestApp,
    csrf: String,
    patient: Uuid,
    uhid: String,
    encounter: Uuid,
    order: Uuid,
}

/// A patient, a GEN-MEDICINE visit and a CBC ordered on it, all by admin.
async fn world() -> World {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let suffix = &Uuid::new_v4().simple().to_string()[..8];
    let uhid = format!("UH-LH-{suffix}");
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
         SELECT tenant_id, $1, 'Lata', 'Handoff', 'female'::gender, $2, DATE '1990-01-15' \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(&uhid)
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&app.db)
    .await
    .expect("patient");
    let encounter = open_visit(&app, &csrf, patient).await;
    let order = order_cbc(&app, &csrf, patient, encounter).await;
    World {
        app,
        csrf,
        patient,
        uhid,
        encounter,
        order,
    }
}

/// Open an OPD visit for `patient` in General Medicine.
async fn open_visit(app: &common::TestApp, csrf: &str, patient: Uuid) -> Uuid {
    let department: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'GEN-MEDICINE'",
    )
    .fetch_one(&app.db)
    .await
    .expect("department");
    let visit: Value = app
        .client
        .post(app.url("/api/opd/encounters"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "patient_id": patient, "department_id": department }))
        .send()
        .await
        .expect("visit")
        .json()
        .await
        .expect("visit json");
    visit["encounter"]["id"]
        .as_str()
        .and_then(|s| s.parse().ok())
        .expect("encounter id")
}

/// Order a CBC on the visit, as the doctor would.
async fn order_cbc(app: &common::TestApp, csrf: &str, patient: Uuid, encounter: Uuid) -> Uuid {
    let test_id: Uuid = sqlx::query_scalar(
        "SELECT c.id FROM lab_test_catalog c JOIN users u ON u.tenant_id = c.tenant_id \
          WHERE u.username = 'admin' AND c.code = 'CBC' LIMIT 1",
    )
    .fetch_one(&app.db)
    .await
    .expect("CBC");
    let resp = app
        .client
        .post(app.url("/api/lab/orders"))
        .header("x-csrf-token", csrf)
        .json(&json!({ "encounter_id": encounter, "patient_id": patient, "test_id": test_id }))
        .send()
        .await
        .expect("order");
    assert_eq!(resp.status(), StatusCode::OK);
    let body: Value = resp.json().await.expect("order json");
    body["id"]
        .as_str()
        .or_else(|| body["order"]["id"].as_str())
        .and_then(|s| s.parse().ok())
        .expect("order id")
}

/// A signed-in lab technician who is a member of the Pathology department.
async fn pathology_technician(w: &World) -> (Client, String) {
    lab_technician(w, true).await
}

/// A signed-in lab technician, in the Pathology department or in none.
async fn lab_technician(w: &World, in_pathology: bool) -> (Client, String) {
    let pathology: Uuid = sqlx::query_scalar(
        "SELECT d.id FROM departments d JOIN users u ON u.tenant_id = d.tenant_id \
          WHERE u.username = 'admin' AND d.code = 'PATHOLOGY'",
    )
    .fetch_one(&w.app.db)
    .await
    .expect("pathology");
    let tag = &Uuid::new_v4().simple().to_string()[..10];
    let (username, password) = (format!("lab_{tag}"), format!("Lab#{tag}Aa9"));
    let created = w
        .app
        .client
        .post(w.app.url("/api/setup/users"))
        .header("x-csrf-token", &w.csrf)
        .json(
            &json!({ "username": username, "email": format!("{username}@example.test"),
                       "password": password, "full_name": "Lab Tech", "role": "lab_technician",
                       "department_ids": if in_pathology { vec![pathology] } else { vec![] } }),
        )
        .send()
        .await
        .expect("user");
    assert_eq!(created.status(), StatusCode::OK);
    let lab = Client::builder()
        .cookie_store(true)
        .build()
        .expect("client");
    let login: Value = lab
        .post(w.app.url("/api/auth/login"))
        .json(&json!({ "username": username, "password": password }))
        .send()
        .await
        .expect("login")
        .json()
        .await
        .expect("login json");
    (
        lab,
        login["csrf_token"].as_str().unwrap_or_default().to_owned(),
    )
}

/// Active Pathology handoff tuples on `object_type`/`id`.
async fn handoffs(app: &common::TestApp, object_type: &str, id: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT count(*) FROM relation_tuples WHERE object_type = $1 AND object_id = $2 \
            AND relation = 'dept_member' AND granted_reason = 'handoff:PATHOLOGY' \
            AND status = 'active'",
    )
    .bind(object_type)
    .bind(id)
    .fetch_one(&app.db)
    .await
    .expect("count")
}

/// POST `body` to `path` as the technician.
async fn lab_post(w: &World, lab: &(Client, String), path: &str, body: Value) -> StatusCode {
    lab_send(w, lab, (reqwest::Method::POST, path), body).await
}

/// PUT `body` to `path` as the technician (the order's status steps).
async fn lab_put(w: &World, lab: &(Client, String), path: &str, body: Value) -> StatusCode {
    lab_send(w, lab, (reqwest::Method::PUT, path), body).await
}

/// Send `body` with `method` to `path` as the technician.
async fn lab_send(
    w: &World,
    lab: &(Client, String),
    (method, path): (reqwest::Method, &str),
    body: Value,
) -> StatusCode {
    lab.0
        .request(method, w.app.url(path))
        .header("x-csrf-token", &lab.1)
        .json(&body)
        .send()
        .await
        .expect("request")
        .status()
}

/// Given a doctor's lab order, When a Pathology technician works it, Then
/// they open the order with the patient's name, UHID, sex and age, collect
/// the sample against the wristband and enter results; And the patient's
/// record, the visit and the patient's other visit answer 404.
#[tokio::test]
async fn the_lab_works_the_order_and_cannot_open_the_record() {
    let w = world().await;
    assert_eq!(
        handoffs(&w.app, "encounter", w.encounter).await,
        0,
        "visit not handed over"
    );
    assert_eq!(
        handoffs(&w.app, "lab_order", w.order).await,
        1,
        "the order is"
    );
    let lab = pathology_technician(&w).await;

    let detail: Value = lab
        .0
        .get(w.app.url(&format!("/api/lab/orders/{}", w.order)))
        .send()
        .await
        .expect("detail")
        .json()
        .await
        .expect("detail json");
    assert_eq!(detail["patient"]["full_name"], "Lata Handoff", "{detail}");
    assert_eq!(detail["patient"]["uhid"], w.uhid.as_str());
    assert_eq!(detail["patient"]["gender"], "female");
    assert!(
        detail["patient"]["age_years"]
            .as_i64()
            .is_some_and(|a| a >= 36),
        "{detail}"
    );

    let order = format!("/api/lab/orders/{}", w.order);
    let collect = json!({ "patient_identifier": w.uhid });
    assert_eq!(
        lab_put(&w, &lab, &format!("{order}/collect"), collect).await,
        StatusCode::OK
    );
    assert_eq!(
        lab_put(&w, &lab, &format!("{order}/process"), json!({})).await,
        StatusCode::OK
    );
    let results = json!({ "results": [{ "parameter_name": "Hemoglobin", "value": "12.9",
                                         "unit": "g/dL" }] });
    assert_eq!(
        lab_post(&w, &lab, &format!("{order}/results"), results).await,
        StatusCode::OK
    );
    let queue = json!({ "order_id": w.order, "patient_id": w.patient });
    assert_eq!(
        lab_post(&w, &lab, "/api/lab/phlebotomy-queue", queue).await,
        StatusCode::OK
    );

    let other_visit = open_visit(&w.app, &w.csrf, w.patient).await;
    for path in [
        format!("/api/patients/{}", w.patient),
        format!("/api/opd/encounters/{}", w.encounter),
        format!("/api/opd/encounters/{other_visit}"),
    ] {
        let status = lab
            .0
            .get(w.app.url(&path))
            .send()
            .await
            .expect("get")
            .status();
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
    }
}

/// The order opens the order, nothing patient-wide and nothing new: holding
/// an order does not list the patient's crossmatches, does not let the lab
/// raise an order on another of the patient's visits, and a technician who
/// does not hold the order cannot send it out or print it. A bulk print
/// names at most 100 orders.
#[tokio::test]
async fn holding_an_order_opens_nothing_past_it() {
    let w = world().await;
    let lab = pathology_technician(&w).await;
    let order = format!("/api/lab/orders/{}", w.order);

    let crossmatch = lab
        .0
        .get(w.app.url(&format!("{order}/crossmatch")))
        .send()
        .await
        .expect("crossmatch")
        .status();
    assert_eq!(
        crossmatch,
        StatusCode::NOT_FOUND,
        "crossmatches are patient-wide"
    );

    let other_visit = open_visit(&w.app, &w.csrf, w.patient).await;
    let test_id: Uuid = sqlx::query_scalar("SELECT test_id FROM lab_orders WHERE id = $1")
        .bind(w.order)
        .fetch_one(&w.app.db)
        .await
        .expect("test");
    let raise = json!({ "encounter_id": other_visit, "patient_id": w.patient, "test_id": test_id });
    assert_eq!(
        lab_post(&w, &lab, "/api/lab/orders", raise).await,
        StatusCode::NOT_FOUND,
        "an order on a visit needs the patient's care team"
    );

    let outsider = lab_technician(&w, false).await;
    let send_out = json!({ "order_id": w.order, "external_lab_name": "Reference Lab" });
    assert_eq!(
        lab_post(&w, &outsider, "/api/lab/outsourced", send_out).await,
        StatusCode::NOT_FOUND
    );
    let print = json!({ "order_ids": [w.order] });
    assert_eq!(
        lab_post(&w, &outsider, "/api/lab/reports/bulk-print", print).await,
        StatusCode::NOT_FOUND
    );
    let too_many: Vec<Uuid> = (0..101).map(|_| Uuid::new_v4()).collect();
    assert_eq!(
        lab_post(
            &w,
            &lab,
            "/api/lab/reports/bulk-print",
            json!({ "order_ids": too_many })
        )
        .await,
        StatusCode::BAD_REQUEST
    );
}

/// When a lab write names an order and a different patient, Then it answers
/// 404: the body cannot attach the lab's work to somebody else's record.
#[tokio::test]
async fn a_lab_write_for_another_patient_is_refused() {
    let w = world().await;
    let lab = pathology_technician(&w).await;
    let stranger: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         SELECT tenant_id, $1, 'Some', 'Stranger', 'male'::gender, $2 \
           FROM users WHERE username = 'admin' RETURNING id",
    )
    .bind(format!(
        "UH-LS-{}",
        &Uuid::new_v4().simple().to_string()[..8]
    ))
    .bind(format!("9{}", &Uuid::new_v4().as_u128().to_string()[..9]))
    .fetch_one(&w.app.db)
    .await
    .expect("stranger");
    let queue = json!({ "order_id": w.order, "patient_id": stranger });
    assert_eq!(
        lab_post(&w, &lab, "/api/lab/phlebotomy-queue", queue).await,
        StatusCode::NOT_FOUND
    );
}

/// Given a visit handed to Pathology before this change, When migration 1415
/// runs, Then the visit tuple is revoked (kept, marked for SpiceDB) and the
/// visit's lab order is handed to Pathology instead.
#[tokio::test]
async fn migration_1415_moves_old_visit_handoffs_onto_the_orders() {
    let w = world().await;
    sqlx::query(
        "UPDATE relation_tuples SET status = 'revoked' \
          WHERE object_type = 'lab_order' AND object_id = $1 \
            AND granted_reason = 'handoff:PATHOLOGY'",
    )
    .bind(w.order)
    .execute(&w.app.db)
    .await
    .expect("as if the order was never handed over");
    sqlx::query(
        "INSERT INTO relation_tuples (tenant_id, object_type, object_id, relation, \
                 subject_type, subject_id, granted_by, granted_reason) \
         SELECT u.tenant_id, 'encounter', $1, 'dept_member', 'department', d.id::text, u.id, \
                'handoff:PATHOLOGY' \
           FROM users u JOIN departments d ON d.tenant_id = u.tenant_id AND d.code = 'PATHOLOGY' \
          WHERE u.username = 'admin'",
    )
    .bind(w.encounter)
    .execute(&w.app.db)
    .await
    .expect("legacy visit handoff");

    sqlx::raw_sql(include_str!(
        "../../medbrains-db-migrations/src/migrations/1415_revoke_lab_visit_handoff.sql"
    ))
    .execute(&w.app.db)
    .await
    .expect("migration 1415");

    assert_eq!(handoffs(&w.app, "encounter", w.encounter).await, 0);
    assert_eq!(handoffs(&w.app, "lab_order", w.order).await, 1);
    let (status, sync): (String, String) = sqlx::query_as(
        "SELECT status, spicedb_sync_status FROM relation_tuples \
          WHERE object_type = 'encounter' AND object_id = $1 \
            AND granted_reason = 'handoff:PATHOLOGY'",
    )
    .bind(w.encounter)
    .fetch_one(&w.app.db)
    .await
    .expect("revoked row kept");
    assert_eq!((status.as_str(), sync.as_str()), ("revoked", "pending"));
}

/// An error from the authorization backend: an outage, not a refusal.
fn unreachable_backend<T>() -> Result<T, AuthzError> {
    Err(AuthzError::Other("authz backend unreachable".to_owned()))
}

/// An authorization backend whose care-team answer is `care` (an outage when
/// `None`) and which always admits `view` on the lab order itself.
struct OrderOnly {
    care: Option<bool>,
}

#[async_trait::async_trait]
impl AuthzBackend for OrderOnly {
    async fn check(
        &self,
        _: &AuthzContext,
        _: Relation,
        object_type: &str,
        _: Uuid,
    ) -> Result<bool, AuthzError> {
        if object_type == "lab_order" {
            return Ok(true);
        }
        self.care.map_or_else(unreachable_backend, Ok)
    }
    async fn expand(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        unreachable_backend()
    }
    async fn list_accessible(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        unreachable_backend()
    }
    async fn write_tuple(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
        _: Relation,
        _: Subject,
        _: Option<chrono::DateTime<chrono::Utc>>,
        _: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        unreachable_backend()
    }
    async fn grant_raw(
        &self,
        _: &AuthzContext,
        _: &str,
        _: Uuid,
        _: &str,
        _: Subject,
        _: Option<chrono::DateTime<chrono::Utc>>,
        _: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        unreachable_backend()
    }
    async fn revoke_tuple(&self, _: &AuthzContext, _: Uuid) -> Result<(), AuthzError> {
        unreachable_backend()
    }
}

/// The lab order gate for `order`, run against a backend whose care-team
/// answer is `care`.
async fn order_gate(w: &World, care: Option<bool>) -> Result<(), AppError> {
    let (tenant_id,): (Uuid,) =
        sqlx::query_as("SELECT tenant_id FROM users WHERE username = 'admin'")
            .fetch_one(&w.app.db)
            .await
            .expect("tenant");
    let claims = Claims {
        sub: Uuid::new_v4(),
        tenant_id,
        role: "lab_technician".to_owned(),
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version: 1,
        paired_device_id: None,
        act: None,
        exp: usize::MAX,
    };
    let mut state = w.app.state.clone();
    state.authz = std::sync::Arc::new(OrderOnly { care });
    medbrains_authz_gate::require_access_via(
        &state,
        &claims,
        medbrains_authz_gate::links::LAB_ORDER,
        w.order,
    )
    .await
}

/// When the care-team check cannot be answered, Then the lab order gate
/// answers 503 and never falls through to the order's own view. The control:
/// a care-team REFUSAL does fall through, and the same order view admits.
#[tokio::test]
async fn an_outage_on_the_care_check_is_503_not_the_fallback() {
    let w = world().await;
    assert!(
        order_gate(&w, Some(false)).await.is_ok(),
        "a refusal falls through"
    );
    let outage = order_gate(&w, None).await;
    assert!(
        matches!(outage, Err(AppError::ServiceUnavailable(_))),
        "an outage must stay an outage: {outage:?}"
    );
}
