//! Nothing identifying reaches the model: the patient's whole record, read by
//! the assistant's API tool, and a free-text note about them, both leave with
//! zero identifiers — and the answer reads back with the real names.

use crate::common;

use medbrains_server::middleware::auth::{ActingAgent, ActorKind, Claims};
use medbrains_server::routes;
use uuid::Uuid;

const SECRETS: &[&str] = &[
    "Kavitha",
    "Subramanian",
    "Murugan",
    "Selvi",
    "Ramasamy",
    "9840012345",
    "9444455555",
    "91-4411-2233-5566",
    "kavitha.s@abdm",
    "Kamaraj Salai",
    "kavitha@example.in",
];

fn assert_no_leak(payload: &str) {
    let lower = payload.to_lowercase();
    for s in SECRETS {
        assert!(
            !lower.contains(&s.to_lowercase()),
            "LEAK of {s:?} to the model:\n{payload}"
        );
    }
}

async fn nothing_identifying_reaches_the_model(app: common::TestApp) {
    let (tenant, admin, role, perm_version): (Uuid, Uuid, String, i32) = sqlx::query_as(
        "SELECT tenant_id, id, role::text, perm_version FROM users WHERE username = 'admin'",
    )
    .fetch_one(&app.db)
    .await
    .expect("admin");
    let uhid = format!("UH-RD-{}", &Uuid::new_v4().simple().to_string()[..8]);
    let patient: Uuid = sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone, email, \
             father_name, abha_number, abha_address, address_line1, date_of_birth) \
         VALUES ($1, $2, 'Kavitha', 'Subramanian', 'female', '9840012345', 'kavitha@example.in', \
             'Murugan Subramanian', '91-4411-2233-5566', 'kavitha.s@abdm', '14, Kamaraj Salai', \
             '1979-03-12') RETURNING id",
    )
    .bind(tenant)
    .bind(&uhid)
    .fetch_one(&app.db)
    .await
    .expect("patient");
    sqlx::query(
        "INSERT INTO patient_contacts (tenant_id, patient_id, contact_name, relation, phone) \
         VALUES ($1, $2, 'Selvi Ramasamy', 'mother', '9444455555')",
    )
    .bind(tenant)
    .bind(patient)
    .execute(&app.db)
    .await
    .expect("contact");

    let claims = Claims {
        sub: admin,
        tenant_id: tenant,
        role,
        permissions: Vec::new(),
        department_ids: Vec::new(),
        perm_version,
        paired_device_id: None,
        act: Some(ActingAgent {
            kind: ActorKind::AiAgent,
            agent: "clinical_assistant".to_owned(),
            model: "test".to_owned(),
            run_id: Uuid::new_v4(),
            conversation_id: None,
        }),
        exp: usize::MAX,
    };
    let mut session = medbrains_ai::session_for(&app.state, &claims, Some(patient), None)
        .await
        .expect("session");

    // The record, as the assistant's read tool fetches it.
    let router = routes::build_router(app.state.clone());
    let record = medbrains_ai::call_api_as_agent(
        router,
        &app.state,
        &claims,
        &format!("/api/patients/{patient}"),
    )
    .await
    .expect("read");
    assert!(
        record.starts_with("HTTP 200") && record.contains("Kavitha"),
        "{record}"
    );
    let to_model = session.redact(&record).expect("redact record");
    assert_no_leak(to_model.for_model());
    assert!(!to_model.for_model().contains(&uhid), "UHID leaked");

    // A note typed about her, naming her mother from the contacts table.
    let note = format!(
        "Kavitha (UHID {uhid}) c/o breathlessness. Her mother Selvi called from 9444455555; \
         father Murugan at bedside. Echo booked."
    );
    let to_model = session.redact(&note).expect("redact note");
    assert_no_leak(to_model.for_model());
    assert!(
        to_model.for_model().contains("breathlessness") && to_model.for_model().contains("Echo")
    );

    // The answer reads back for the clinician with the real names.
    let shown = session.rehydrate("Ask [RELATIVE_1] whether [PATIENT_1] has orthopnoea.");
    assert!(shown.contains("Kavitha Subramanian"), "{shown}");
}

#[tokio::test]
async fn nothing_identifying_reaches_the_model_as_owner() {
    nothing_identifying_reaches_the_model(common::spawn_app().await).await;
}

#[tokio::test]
async fn nothing_identifying_reaches_the_model_as_request_role() {
    nothing_identifying_reaches_the_model(common::spawn_app_as_request_role().await).await;
}
