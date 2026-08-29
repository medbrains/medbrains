mod common;

use uuid::Uuid;

async fn seeded_tenant(db: &sqlx::PgPool) -> Uuid {
    sqlx::query_scalar("SELECT id FROM tenants LIMIT 1")
        .fetch_one(db)
        .await
        .expect("a seeded tenant")
}

async fn enquiry(db: &sqlx::PgPool, tenant_id: Uuid, name: &str, phone: &str) -> Uuid {
    sqlx::query_scalar(
        "INSERT INTO mkt_contacts (tenant_id, primary_phone, display_name, source) \
         VALUES ($1, $2, $3, 'test') RETURNING id",
    )
    .bind(tenant_id)
    .bind(phone)
    .bind(name)
    .fetch_one(db)
    .await
    .expect("insert enquiry")
}

async fn patient(db: &sqlx::PgPool, tenant_id: Uuid, first: &str, phone: &str) -> Uuid {
    let suffix = &Uuid::new_v4().to_string()[..8];
    sqlx::query_scalar(
        "INSERT INTO patients (tenant_id, uhid, first_name, last_name, gender, phone) \
         VALUES ($1, $2, $3, 'Fixture', 'other'::gender, $4) RETURNING id",
    )
    .bind(tenant_id)
    .bind(format!("UH-{suffix}"))
    .bind(first)
    .bind(phone)
    .fetch_one(db)
    .await
    .expect("insert patient")
}

/// Every patient on the number is offered, including the ones whose names do
/// not match.
///
/// This is the whole design. `find_or_create_patient` in public booking
/// carries the scar in a comment — "Family members share phones — phone alone
/// booked into the wrong record (audit P1)" — and a lead converter that
/// auto-matched on number would repeat it, attaching the enquiry and every
/// future recall to the wrong chart.
///
/// So the mother and the son both come back, flagged, and the desk chooses.
#[tokio::test]
async fn both_people_on_a_shared_phone_are_offered_and_flagged() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id = seeded_tenant(&app.db).await;

    let phone = format!("+919{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    patient(&app.db, tenant_id, "Lakshmi", &phone).await;
    patient(&app.db, tenant_id, "Ravi", &phone).await;

    // The son rings about his mother, giving his own name.
    let contact_id = enquiry(&app.db, tenant_id, "Ravi Kumar", &phone).await;

    let matches: Vec<serde_json::Value> = app
        .client
        .get(app.url(&format!("/api/marketing/contacts/{contact_id}/patient-matches")))
        .header("x-csrf-token", &csrf)
        .send()
        .await
        .expect("patient matches")
        .json()
        .await
        .expect("matches json");

    assert_eq!(
        matches.len(),
        2,
        "both people on the phone must be offered — filtering to the name \
         match is how the enquiry lands on the wrong chart"
    );

    let ravi = matches
        .iter()
        .find(|m| m["first_name"] == "Ravi")
        .expect("Ravi must be offered");
    let lakshmi = matches
        .iter()
        .find(|m| m["first_name"] == "Lakshmi")
        .expect("Lakshmi must be offered");

    assert_eq!(ravi["name_matches"], serde_json::json!(true));
    assert_eq!(
        lakshmi["name_matches"],
        serde_json::json!(false),
        "the different name must be flagged, not hidden — the desk has just \
         spoken to them and is the only party who can tell"
    );
    assert_eq!(
        matches[0]["first_name"], "Ravi",
        "the name match sorts first, as a hint rather than a decision"
    );
}

/// Linking closes the enquiry: it stamps the patient, moves to the won stage,
/// records the transition, closes the callback and writes the timeline entry —
/// all in one transaction.
///
/// The callback matters most. Ringing somebody to ask whether they would like
/// to register, after they have registered, is the specific embarrassment a
/// half-finished conversion produces.
#[tokio::test]
async fn linking_closes_the_enquiry_and_the_callback_with_it() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id = seeded_tenant(&app.db).await;

    let phone = format!("+919{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let patient_id = patient(&app.db, tenant_id, "Meena", &phone).await;
    let contact_id = enquiry(&app.db, tenant_id, "Meena", &phone).await;

    sqlx::query(
        "INSERT INTO mkt_tasks (tenant_id, contact_id, due_at, kind) \
         VALUES ($1, $2, now(), 'callback')",
    )
    .bind(tenant_id)
    .bind(contact_id)
    .execute(&app.db)
    .await
    .expect("insert callback");

    let res = app
        .client
        .post(app.url(&format!("/api/marketing/contacts/{contact_id}/convert")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({ "action": "link", "patient_id": patient_id }))
        .send()
        .await
        .expect("convert");
    assert!(res.status().is_success(), "convert rejected: {:?}", res.status());

    let linked: Option<Uuid> = sqlx::query_scalar("SELECT patient_id FROM mkt_contacts WHERE id = $1")
        .bind(contact_id)
        .fetch_one(&app.db)
        .await
        .expect("read patient_id");
    assert_eq!(linked, Some(patient_id));

    let open_callbacks: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_tasks WHERE contact_id = $1 AND status = 'open'",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("count callbacks");
    assert_eq!(
        open_callbacks, 0,
        "the callback must close with the conversion, or the desk rings \
         somebody to offer them what they already have"
    );

    let won: bool = sqlx::query_scalar(
        "SELECT COALESCE(s.is_won, false) FROM mkt_contacts c \
         LEFT JOIN mkt_pipeline_stages s ON s.id = c.stage_id \
         WHERE c.id = $1",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("read stage");
    assert!(won, "a converted enquiry must land in the won stage to be counted");

    let events: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_stage_events WHERE contact_id = $1",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("count stage events");
    assert!(events >= 1, "the move must be on the funnel history too");

    let logged: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM mkt_interactions \
         WHERE contact_id = $1 AND kind = 'conversion'",
    )
    .bind(contact_id)
    .fetch_one(&app.db)
    .await
    .expect("count interactions");
    assert_eq!(logged, 1, "who converted this, and when, is an audit question");
}

/// Registering mints one UHID and links it.
#[tokio::test]
async fn registering_from_an_enquiry_creates_exactly_one_patient() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id = seeded_tenant(&app.db).await;

    let phone = format!("+919{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let contact_id = enquiry(&app.db, tenant_id, "Anand Raj", &phone).await;

    let body: serde_json::Value = app
        .client
        .post(app.url(&format!("/api/marketing/contacts/{contact_id}/convert")))
        .header("x-csrf-token", &csrf)
        .json(&serde_json::json!({
            "action": "register", "first_name": "Anand", "last_name": "Raj",
            "gender": "male",
        }))
        .send()
        .await
        .expect("convert")
        .json()
        .await
        .expect("convert json");

    assert_eq!(body["registered"], serde_json::json!(true));
    assert!(
        body["uhid"].as_str().is_some_and(|u| !u.is_empty()),
        "a registered patient must carry a UHID from the tenant's own sequence"
    );

    let created: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patients WHERE tenant_id = $1 AND phone = $2",
    )
    .bind(tenant_id)
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("count patients");
    assert_eq!(created, 1, "exactly one patient, not two");
}

/// Converting twice is refused rather than made idempotent.
///
/// A second conversion would mint a second UHID for somebody already
/// registered, splitting their clinical history across two charts. Refusing
/// tells the second agent what happened; silently succeeding would not.
#[tokio::test]
async fn an_enquiry_cannot_be_converted_twice() {
    let app = common::spawn_app().await;
    let csrf = app.login_admin().await;
    let tenant_id = seeded_tenant(&app.db).await;

    let phone = format!("+919{}", &Uuid::new_v4().as_u128().to_string()[..9]);
    let patient_id = patient(&app.db, tenant_id, "Priya", &phone).await;
    let contact_id = enquiry(&app.db, tenant_id, "Priya", &phone).await;

    let convert = || {
        app.client
            .post(app.url(&format!("/api/marketing/contacts/{contact_id}/convert")))
            .header("x-csrf-token", &csrf)
            .json(&serde_json::json!({ "action": "link", "patient_id": patient_id }))
            .send()
    };

    assert!(convert().await.expect("first convert").status().is_success());
    assert_eq!(
        convert().await.expect("second convert").status().as_u16(),
        409,
        "a second conversion would mint a second UHID and split the chart"
    );

    let patients: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM patients WHERE tenant_id = $1 AND phone = $2",
    )
    .bind(tenant_id)
    .bind(&phone)
    .fetch_one(&app.db)
    .await
    .expect("count patients");
    assert_eq!(patients, 1, "and no duplicate may have been created on the way");
}
